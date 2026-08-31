// Pipeline health — the portfolio view (ROADMAP R-2).
//
// /dashboard answers "what is on my plate". This answers "where do I need to
// look", across every live project, for a PM or a senior leader. The two are
// deliberately separate pages: merging them would put a personal task list and
// a portfolio triage view in competition for the top of the screen.
//
// The page leads with MOVEMENT (what changed in the window) and backs it with
// STATE (where every project stands right now). Movement first is the whole
// point — a static red/amber/green table is already available on /projects; the
// thing it cannot tell you is which of those lights changed this week.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'
import {
  rollUpMajor, suggestDealHealth, nextMilestone,
  type MajorDef, type Milestone, type MajorRollup,
} from '@/lib/workstreams'
import {
  toMovements, groupByProject, summarize,
  HISTORY_STARTS_AT, type ActivityRow,
} from '@/lib/health-feed'
import { HealthClient, type HealthProject } from '@/components/health/HealthClient'

export const dynamic = 'force-dynamic'

/** Windows the header offers. 7 is the default because the ask is weekly. */
const WINDOWS = [7, 14, 30]

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Defense in depth: the nav item is hidden for team/investor, and the route
  // refuses them too. Hiding a link is not access control.
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!isManagerOrAbove(profile?.role)) redirect('/dashboard')

  const { days: daysParam } = await searchParams
  const days = WINDOWS.includes(Number(daysParam)) ? Number(daysParam) : 7
  const since = new Date(Date.now() - days * 86_400_000)
  const sinceIso = since.toISOString()

  // ── Portfolio fetch ────────────────────────────────────────────────
  // The major catalog is the same ~18 rows for every project, so it is fetched
  // once and the per-project milestones are grouped below — same shape as the
  // projects list, for the same reason.
  const [{ data: projects }, { data: users }, { data: wsDefs }, { data: wsMajorState }, { data: activity }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, project_number, name, stage, deal_health, deal_health_override, on_hold_at, city, state, assignee_id, users!assignee_id(full_name, avatar_url)')
        .neq('stage', 'Archived')
        .order('name') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('users').select('id, full_name, avatar_url') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_majors').select('*').order('workstream').order('sort_order') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_major_state').select('project_id, major_key, completed_at') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      // Only the two entity types that carry direction. Everything else in the
      // log (files, mentions, owner changes) belongs to the project feed.
      supabase
        .from('activity_log')
        .select('id, entity_type, entity_id, action, user_id, created_at, metadata')
        .in('entity_type', ['project', 'workstream_milestone'])
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1000) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

  // Milestones for the whole portfolio, paged.
  //
  // PostgREST caps a response at 1000 rows and 19 projects x ~48 milestones is
  // already ~900. Left unpaged this would start truncating silently as projects
  // are added, and the projects whose rows fell off the end would quietly lose
  // their health rather than erroring.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsMilestones: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workstream_milestones')
      .select('id, project_id, major_key, end_date, baseline_date, status, weight_pct, is_critical')
      .order('sort_order')
      .range(from, from + PAGE - 1) as { data: any[] | null; error: unknown } // eslint-disable-line @typescript-eslint/no-explicit-any
    if (error || !data?.length) break
    wsMilestones.push(...data)
    if (data.length < PAGE) break
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestonesByProject = new Map<string, any[]>()
  for (const m of wsMilestones) {
    const list = milestonesByProject.get(m.project_id)
    if (list) list.push(m)
    else milestonesByProject.set(m.project_id, [m])
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateByProject = new Map<string, any[]>()
  for (const s of (wsMajorState ?? [])) {
    const list = stateByProject.get(s.project_id)
    if (list) list.push(s)
    else stateByProject.set(s.project_id, [s])
  }

  const defs = (wsDefs ?? []) as MajorDef[]

  // ── State: where every project stands right now ────────────────────
  // A held project (migration 068, `projects.on_hold_at`) has nothing to say
  // about schedule: rollUpMajor/suggestDealHealth already suppress variance and
  // the traffic light while paused, so a hold reads as "no opinion" rather than
  // bleeding red purely because time kept passing.
  const heldProjectIds = new Set(
    (projects ?? []).filter((p: { on_hold_at?: string | null }) => !!p.on_hold_at).map((p: { id: string }) => p.id),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: HealthProject[] = (projects ?? []).map((p: any) => {
    const mine = (milestonesByProject.get(p.id) ?? []) as Milestone[]
    const state = stateByProject.get(p.id) ?? []
    const paused = !!p.on_hold_at
    const overrides = new Map<string, string | null>(state.map(s => [s.major_key, s.completed_at]))
    const rollups: MajorRollup[] = defs.map(d =>
      rollUpMajor(d, mine, undefined, overrides.get(d.key) ?? null, paused))

    const suggestion = suggestDealHealth(rollups, paused)
    // nextMilestone() doesn't take `paused` — it calls rollUpMajor internally
    // without it, so the label/date it returns are still date-driven for a held
    // project. That's a real gap in the shared helper (worth fixing there, not
    // patched around per-caller); until then, the variance shown below is
    // suppressed at this page regardless of what it computed.
    const next = nextMilestone(defs, mine, state)

    // The single worst slip across the project's majors — the headline number
    // for "how far off the original commitment are we", independent of which
    // milestone happens to be next. Meaningless while paused, for the same
    // reason variance is suppressed above.
    const slips = paused ? [] : rollups.map(r => r.slipDays ?? 0).filter(d => d > 0)
    const worstSlip = slips.length ? Math.max(...slips) : 0

    return {
      id: p.id,
      name: p.name,
      projectNumber: p.project_number,
      stage: p.stage,
      dealHealth: p.deal_health ?? 'TBD',
      // Added by migration 063 (applied). Selected in the query above, so if it
      // were missing the whole projects fetch would error rather than degrade —
      // this page has a hard dependency on 063, not a soft one.
      dealHealthOverride: p.deal_health_override === true,
      suggestedHealth: suggestion.value,
      suggestionReason: suggestion.reason,
      paused,
      city: p.city,
      state: p.state,
      assigneeName: p.users?.full_name ?? null,
      nextMilestone: next?.label ?? null,
      nextMilestoneDate: next?.end ?? null,
      nextMilestoneVariance: paused ? null : (next?.variance ?? null),
      worstSlip,
      overdueCount: paused ? 0 : rollups.reduce((n, r) => n + r.overdueCount, 0),
      blockedCount: mine.filter(m => m.status === 'blocked').length,
    }
  })

  // ── Movement: what changed in the window ───────────────────────────
  // Archived projects are filtered out of `rows`, so movements pointing at one
  // would have no group header to sit under. Dropping them here keeps the feed
  // consistent with the table rather than half-rendering an unknown project.
  const known = new Set(rows.map(r => r.id))
  const movements = toMovements((activity ?? []) as ActivityRow[])
    .filter(m => known.has(m.projectId))
    // A milestone's target date carries no schedule meaning while its project is
    // paused — the state table already suppresses variance for the same reason
    // (see `paused` above). A human-set signal (status, risk, a gate) still
    // counts on a held project; only the date-derived movement is dropped.
    .filter(m => !(m.kind === 'milestone_date' && heldProjectIds.has(m.projectId)))
  const groups = groupByProject(movements)
  const summary = summarize(groups)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorNames: Record<string, string> = {}
  for (const u of (users ?? []) as any[]) actorNames[u.id] = u.full_name ?? '' // eslint-disable-line @typescript-eslint/no-explicit-any

  // Field-level change logging went live 2026-08-26. A window reaching back
  // before that is empty for want of a record, not for want of movement, and
  // the UI says so rather than implying a quiet week.
  const windowPredatesHistory = sinceIso.slice(0, 10) < HISTORY_STARTS_AT

  return (
    <HealthClient
      days={days}
      windows={WINDOWS}
      groups={groups}
      summary={summary}
      projects={rows}
      actorNames={actorNames}
      historyStartsAt={HISTORY_STARTS_AT}
      windowPredatesHistory={windowPredatesHistory}
    />
  )
}
