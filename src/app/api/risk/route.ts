import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isManagerOrAbove } from '@/lib/permissions'
import {
  scoreRisk, fingerprint, isConfigured,
  type RiskInput, type RiskCounts,
} from '@/lib/risk'

/**
 * POST — (re)score project risk (migration 070).
 *
 * Body: { projectId } to score one, or {} to sweep every active project.
 *
 * Scoring is deliberately an explicit action rather than something the board
 * does on render: it calls a third-party model, costs money per project, and
 * takes seconds. Projects whose inputs are unchanged since the last run are
 * skipped on their fingerprint, so pressing "rescore all" twice does not bill
 * twice.
 *
 * ⚠️ This sends weekly notes and thread messages to Google's Gemini API. That
 * is project correspondence leaving the org, including anything synced in from
 * Outlook. It is opt-in by construction — with no GEMINI_API_KEY set, nothing
 * is ever sent and the route reports that it is not configured.
 */

export const dynamic = 'force-dynamic'
/** Sweeping the portfolio is many sequential model calls. */
export const maxDuration = 60

const WINDOW_DAYS = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
  if (!isManagerOrAbove(me?.role)) {
    return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: 'Risk scoring is not configured. Set GEMINI_API_KEY.' },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => ({})) as { projectId?: string; force?: boolean }
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString()

  // ── which projects ──
  let q = supabase
    .from('projects')
    .select('id, name, stage, on_hold_at')
    .neq('stage', 'Archived')
  if (body.projectId) q = q.eq('id', body.projectId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await q as unknown as { data: any[] | null }

  const targets = (projects ?? []).filter(p => body.projectId || !p.on_hold_at)
  if (!targets.length) return NextResponse.json({ ok: true, scored: 0, skipped: 0 })

  const ids = targets.map(p => p.id)

  // ── inputs, fetched once for the whole batch ──
  const [
    { data: milestones }, { data: deps }, { data: tasks },
    { data: rfis }, { data: threads }, { data: updates }, { data: existing },
  ] = await Promise.all([
    supabase.from('workstream_milestones')
      .select('id, project_id, status, is_critical, created_at').in('project_id', ids) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('workstream_milestone_deps')
      .select('milestone_id, depends_on') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('tasks')
      .select('id, project_id, status, created_at').in('project_id', ids) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('rfis')
      .select('id, project_id, status').in('project_id', ids) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('project_threads')
      .select('project_id, message, created_at').in('project_id', ids)
      .gte('created_at', since).order('created_at', { ascending: false }) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('workstream_updates')
      .select('project_id, body, created_at').in('project_id', ids)
      .gte('created_at', since).order('created_at', { ascending: false }) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('project_risk')
      .select('project_id, input_fingerprint').in('project_id', ids) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const group = <T extends { project_id: string | null }>(rows: T[] | null) => {
    const map = new Map<string, T[]>()
    for (const r of rows ?? []) {
      if (!r.project_id) continue
      const list = map.get(r.project_id)
      if (list) list.push(r)
      else map.set(r.project_id, [r])
    }
    return map
  }

  const msByP = group(milestones)
  const taskByP = group(tasks)
  const rfiByP = group(rfis)
  const threadByP = group(threads)
  const updateByP = group(updates)
  const priorFingerprint = new Map<string, string | null>(
    (existing ?? []).map(r => [r.project_id, r.input_fingerprint]))

  // Dependency edges are keyed by milestone, so attribute them to the project
  // that owns the dependent milestone.
  const milestoneProject = new Map<string, string>((milestones ?? []).map(m => [m.id, m.project_id]))
  const depCount = new Map<string, number>()
  for (const d of (deps ?? [])) {
    const pid = milestoneProject.get(d.milestone_id)
    if (pid) depCount.set(pid, (depCount.get(pid) ?? 0) + 1)
  }

  const recent = (iso: string | null) => !!iso && iso >= since

  let scored = 0
  let skipped = 0
  const failed: string[] = []
  let lastError: string | null = null

  for (const p of targets) {
    const mine = msByP.get(p.id) ?? []
    const myTasks = taskByP.get(p.id) ?? []
    const open = mine.filter(m => m.status !== 'complete')

    const counts: RiskCounts = {
      openMilestones: open.length,
      criticalOpen: open.filter(m => m.is_critical).length,
      blocked: open.filter(m => m.status === 'blocked').length,
      milestonesAddedRecently: mine.filter(m => recent(m.created_at)).length,
      openTasks: myTasks.filter(t => t.status !== 'Complete').length,
      tasksAddedRecently: myTasks.filter(t => recent(t.created_at)).length,
      openRfis: (rfiByP.get(p.id) ?? []).filter(r => r.status !== 'closed' && r.status !== 'draft').length,
      dependencyEdges: depCount.get(p.id) ?? 0,
      threadMessagesRecently: (threadByP.get(p.id) ?? []).length,
      weeklyUpdatesRecently: (updateByP.get(p.id) ?? []).length,
    }

    const input: RiskInput = {
      projectName: p.name,
      stage: p.stage,
      counts,
      notes: (updateByP.get(p.id) ?? []).map(u => u.body as string),
      threads: (threadByP.get(p.id) ?? []).map(t => t.message as string),
    }

    // Skip unchanged input unless forced. This is what makes "rescore all"
    // safe to press — only genuinely-moved projects cost anything.
    if (!body.force && priorFingerprint.get(p.id) === fingerprint(input)) {
      skipped++
      continue
    }

    // eslint-disable-next-line no-await-in-loop
    const result = await scoreRisk(input)
    if (!result) { failed.push(p.name); continue }

    // eslint-disable-next-line no-await-in-loop, @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('project_risk') as any).upsert({
      project_id: p.id,
      score: result.score,
      band: result.band,
      drivers: result.drivers,
      summary: result.summary,
      model: result.model,
      input_fingerprint: result.fingerprint,
      scored_at: new Date().toISOString(),
      scored_by: user.id,
    }, { onConflict: 'project_id' })
    if (error) {
      // Log the reason. A silent push onto `failed` cost a debugging session:
      // every model call succeeded, every write failed, and nothing said why.
      console.error('[risk] write failed for', p.name, '—', error.message)
      failed.push(p.name)
      lastError = error.message
      continue
    }
    scored++
  }

  // A run where everything failed is an error, not a success with a zero in it.
  // This previously returned 200 with `ok: false` in the body, and the client
  // only checked the HTTP status — so a total failure rendered as "Scored 0".
  if (failed.length && scored === 0) {
    return NextResponse.json({
      error: lastError
        ? `Scoring failed for all ${failed.length} project(s): ${lastError}`
        : `Scoring failed for all ${failed.length} project(s).`,
      failed,
    }, { status: 502 })
  }

  return NextResponse.json({
    ok: failed.length === 0,
    scored,
    skipped,
    ...(failed.length ? { failed } : {}),
  })
}
