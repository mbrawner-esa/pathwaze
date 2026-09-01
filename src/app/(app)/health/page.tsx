// Portfolio priority — the planning board (ROADMAP R-2).
//
// /dashboard answers "what is on my plate". This answers "where does the team
// put its effort this week", across every actively-worked project, for the
// Director of Project Delivery and the PMs in the room with them.
//
// It is a MEETING surface, not a report: the order is draggable, stages and
// milestone dates are editable in place, and held or archived projects are
// absent entirely. What it deliberately does NOT do is narrate history —
// /projects already carries current status, and a "what changed" feed answers
// a question nobody asks while planning the week ahead.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'
import { type MajorDef, type Milestone } from '@/lib/workstreams'
import { buildRows, orderRows, type ProjectRisk } from '@/lib/portfolio-priority'
import { scoreMomentum, WINDOW_DAYS, type ActivityEvent, type Momentum } from '@/lib/momentum'
import { PriorityBoard } from '@/components/health/PriorityBoard'

export const dynamic = 'force-dynamic'

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Defense in depth: the nav item is hidden for team/investor, and the route
  // refuses them too. Hiding a link is not access control.
  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single() as { data: { role: string } | null }
  if (!isManagerOrAbove(profile?.role)) redirect('/dashboard')

  const sp = await searchParams
  // Whitelist rather than a chain of ternaries: the previous form silently
  // dropped 'graph' back to 'table', so the tab rendered as a no-op.
  const view = (['table', 'graph', 'gantt'] as const).includes(sp.view as never)
    ? (sp.view as 'table' | 'graph' | 'gantt')
    : 'table'

  // ── Portfolio fetch ────────────────────────────────────────────────
  const [{ data: projects }, { data: users }, { data: wsDefs }, { data: wsMajorState }, { data: priority }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, project_number, stage, deal_health, on_hold_at, tranche, assignee_id')
        // Archived is excluded here; On Hold is excluded in buildRows, which
        // also owns the reason why. Both are absent by default, not styled
        // differently — see the module header.
        .neq('stage', 'Archived')
        .order('name') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('users').select('id, full_name, avatar_url') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_majors').select('*').order('workstream').order('sort_order') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_major_state').select('project_id, major_key, owner_id, completed_at') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('portfolio_priority').select('project_id, rank, set_at, set_by').order('rank') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

  // Cached LLM risk (migration 070). Read separately and defensively:
  // scoring is optional, so a missing table or an unscored portfolio must leave
  // the board fully working rather than taking the page down.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: riskRows } = await supabase
    .from('project_risk')
    .select('project_id, score, band, drivers, summary, scored_at, input_fingerprint') as unknown as { data: any[] | null }

  // Milestones for the whole portfolio, paged.
  //
  // PostgREST caps a response at 1000 rows and 19 projects x ~48 milestones is
  // already ~900. Left unpaged this would start truncating silently as projects
  // are added, and the projects whose rows fell off the end would quietly lose
  // their plan rather than erroring.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsMilestones: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workstream_milestones')
      .select('id, project_id, major_key, label, description, stage_gate, weight_pct, is_critical, end_date, baseline_date, status, completed_at, notes, risk, sort_order')
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

  // ── Momentum inputs ────────────────────────────────────────────────
  // Activity is fetched a little wider than the scoring window so "days since
  // last activity" can report a real gap rather than saturating at the window
  // edge — a project silent for seven weeks should say so, not ">30 days".
  const since = new Date(Date.now() - WINDOW_DAYS * 3 * 86_400_000).toISOString()
  const [{ data: activity }, { data: doneTasks }] = await Promise.all([
    supabase
      .from('activity_log')
      .select('entity_type, entity_id, action, created_at, metadata')
      .in('entity_type', ['project', 'workstream_milestone'])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(4000) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase
      .from('tasks')
      .select('project_id, completed_at, workstream_milestone_id')
      .not('completed_at', 'is', null)
      .gte('completed_at', since) as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ])

  // activity_log rows carry their project in metadata for sub-entities, and ARE
  // the project id for entity_type='project' — the same resolution the
  // dashboard does.
  const activityByProject = new Map<string, ActivityEvent[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of ((activity ?? []) as any[])) {
    const pid: string | undefined = e.entity_type === 'project' ? e.entity_id : e.metadata?.project_id
    if (!pid) continue
    const list = activityByProject.get(pid)
    if (list) list.push(e as ActivityEvent)
    else activityByProject.set(pid, [e as ActivityEvent])
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksByProject = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of ((doneTasks ?? []) as any[])) {
    if (!t.project_id) continue
    const list = tasksByProject.get(t.project_id)
    if (list) list.push(t)
    else tasksByProject.set(t.project_id, [t])
  }

  const momentumByProject = new Map<string, Momentum>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of ((projects ?? []) as any[])) {
    momentumByProject.set(p.id, scoreMomentum(
      activityByProject.get(p.id) ?? [],
      tasksByProject.get(p.id) ?? [],
      (milestonesByProject.get(p.id) ?? []) as Milestone[],
    ))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pmNames = new Map<string, string>(((users ?? []) as any[]).map(u => [u.id, u.full_name ?? '']))

  const riskByProject = new Map<string, ProjectRisk>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of ((riskRows ?? []) as any[])) {
    riskByProject.set(c.project_id, {
      score: c.score,
      band: c.band,
      drivers: Array.isArray(c.drivers) ? c.drivers : [],
      summary: c.summary ?? null,
      scoredAt: c.scored_at,
      // Whether the inputs have moved on is only knowable by recomputing the
      // fingerprint, which needs the notes and threads the scoring route
      // fetches. The board does not pay for that on every render; the route
      // decides staleness when it runs.
      stale: false,
    })
  }

  // Department tags (068) and upvotes (071) for the expanded card. Both are
  // read defensively — the board must render even if 071 has not been run.
  const [{ data: deptTags }, { data: depts }, { data: votes }] = await Promise.all([
    supabase.from('workstream_milestone_departments')
      .select('milestone_id, department_key') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('departments').select('key, name').order('sort_order') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    supabase.from('workstream_milestone_votes')
      .select('milestone_id, user_id') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deptName = new Map<string, string>(((depts ?? []) as any[]).map(d => [d.key, d.name]))
  const teamsByMilestone = new Map<string, string[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of ((deptTags ?? []) as any[])) {
    const name = deptName.get(t.department_key)
    if (!name) continue
    const list = teamsByMilestone.get(t.milestone_id)
    if (list) list.push(name)
    else teamsByMilestone.set(t.milestone_id, [name])
  }

  const votesByMilestone = new Map<string, number>()
  const myVotes = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const v of ((votes ?? []) as any[])) {
    votesByMilestone.set(v.milestone_id, (votesByMilestone.get(v.milestone_id) ?? 0) + 1)
    if (v.user_id === user.id) myVotes.add(v.milestone_id)
  }

  const ranks = new Map<string, number>((priority ?? []).map(r => [r.project_id, r.rank]))
  // An empty table means nobody has overridden the automatic sort — that is the
  // difference between "manual order" and "urgency order", and it is the whole
  // reason the ranks live in their own table rather than a nullable column.
  const manual = ranks.size > 0

  const rows = orderRows(
    buildRows(
      (projects ?? []) as Parameters<typeof buildRows>[0],
      (wsDefs ?? []) as MajorDef[],
      milestonesByProject as Map<string, Milestone[]>,
      stateByProject,
      ranks,
      pmNames,
      momentumByProject,
      riskByProject,
    ),
    manual,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const people = ((users ?? []) as any[]).map(u => ({
    id: u.id, name: u.full_name ?? '', avatarUrl: u.avatar_url ?? null,
  }))

  const heldCount = ((projects ?? []) as { on_hold_at: string | null }[])
    .filter(p => !!p.on_hold_at).length

  return (
    <PriorityBoard
      rows={rows}
      people={people}
      view={view}
      manual={manual}
      heldCount={heldCount}
      riskScored={riskByProject.size}
    />
  )
}
