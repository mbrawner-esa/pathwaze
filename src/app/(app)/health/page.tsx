// Portfolio priority — the planning board (ROADMAP R-2).
//
// /dashboard answers "what is on my plate". This answers "where does the team
// put its effort this week", across every actively-worked project, for the
// Director of Project Delivery and the PMs in the room with them.
//
// It is a MEETING surface, not a report: the order is draggable, dates and
// statuses are editable in place, and held projects are absent entirely. What
// it deliberately does NOT do is narrate history — /projects already carries
// current status, and a "what changed" feed answers a question nobody asks
// while planning the week ahead.

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'
import { type MajorDef, type Milestone } from '@/lib/workstreams'
import {
  buildRows, orderRows, HORIZONS,
  type Horizon, type Lens,
} from '@/lib/portfolio-priority'
import { PriorityBoard } from '@/components/health/PriorityBoard'

export const dynamic = 'force-dynamic'

const LENS_KEYS = ['overview', 'commercial', 'technical', 'approvals']

export default async function HealthPage({
  searchParams,
}: {
  searchParams: Promise<{ lens?: string; horizon?: string; view?: string }>
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
  const lens = (LENS_KEYS.includes(sp.lens ?? '') ? sp.lens : 'overview') as Lens
  const horizon = (HORIZONS.includes(Number(sp.horizon) as Horizon)
    ? Number(sp.horizon) : 3) as Horizon
  const view = sp.view === 'gantt' ? 'gantt' : 'table'

  // ── Portfolio fetch ────────────────────────────────────────────────
  const [{ data: projects }, { data: users }, { data: wsDefs }, { data: wsMajorState }, { data: priority }] =
    await Promise.all([
      supabase
        .from('projects')
        .select('id, name, project_number, stage, deal_health, on_hold_at')
        .neq('stage', 'Archived')
        .order('name') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('users').select('id, full_name, avatar_url') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_majors').select('*').order('workstream').order('sort_order') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('workstream_major_state').select('project_id, major_key, owner_id, completed_at') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
      supabase.from('portfolio_priority').select('project_id, rank, set_at, set_by').order('rank') as unknown as Promise<{ data: any[] | null }>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ])

  // Milestones for the whole portfolio, paged.
  //
  // PostgREST caps a response at 1000 rows and 19 projects x ~48 milestones is
  // already ~900. Left unpaged this would start truncating silently as projects
  // are added, and the projects whose rows fell off the end would quietly lose
  // their current milestone rather than erroring.
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
      lens,
      horizon,
    ),
    manual,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const people = ((users ?? []) as any[]).map(u => ({
    id: u.id, name: u.full_name ?? '', avatarUrl: u.avatar_url ?? null,
  }))

  const heldCount = ((projects ?? []) as { on_hold_at: string | null }[])
    .filter(p => !!p.on_hold_at).length

  const setAt = (priority ?? [])[0]?.set_at ?? null

  return (
    <PriorityBoard
      rows={rows}
      people={people}
      lens={lens}
      horizon={horizon}
      view={view}
      manual={manual}
      setAt={setAt}
      heldCount={heldCount}
    />
  )
}
