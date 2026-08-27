import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/ProjectsClient'
import { nextMilestone, type MajorDef, type Milestone } from '@/lib/workstreams'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()

  // Next Milestone comes from Workstreams. The major catalog is fetched once for
  // the whole list — it is the same 18 rows for every project — and the
  // milestones are grouped by project below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: projects }, { data: users }, { data: wsDefs }] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        id, project_number, name, stage, deal_health, system_kwdc,
        city, state, tranche, region, assignee_id,
        utility, target_cod,
        users!assignee_id(full_name, avatar_url),
        systems(size_kwdc)
      `)
      // Archived projects are hidden program-wide. Admins can view them at /admin/archived.
      .neq('stage', 'Archived')
      .order('name') as unknown as { data: any[] | null },
    supabase.from('users').select('id, full_name').eq('status', 'active').order('full_name'),
    supabase.from('workstream_majors').select('*').order('workstream').order('sort_order') as unknown as { data: any[] | null },
  ])

  // Milestones for every project, paged.
  //
  // PostgREST caps a response at 1000 rows, and this query spans the whole
  // portfolio — 19 projects × ~48 milestones is already 897. Left unpaged it
  // would start silently truncating after a couple more projects, and the
  // projects whose rows fell off the end would quietly lose their Next
  // Milestone rather than erroring. So page until a short page comes back.
  //
  // Only the columns the roll-up needs: notes/description rich text would be a
  // lot of payload for nothing at this scale.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsMilestones: any[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('workstream_milestones')
      .select('id, project_id, major_key, end_date, baseline_date, status, weight_pct, is_critical')
      .order('sort_order')
      .range(from, from + PAGE - 1) as { data: any[] | null; error: unknown }
    if (error || !data?.length) break
    wsMilestones.push(...data)
    if (data.length < PAGE) break
  }

  // Manual completion overrides, so a hand-closed major is not announced as the
  // next one due.
  const { data: wsMajorState } = await supabase
    .from('workstream_major_state')
    .select('major_key, completed_at, project_id') as unknown as { data: any[] | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestonesByProject = new Map<string, any[]>()
  for (const m of (wsMilestones ?? [])) {
    const list = milestonesByProject.get(m.project_id)
    if (list) list.push(m)
    else milestonesByProject.set(m.project_id, [m])
  }
  const defs = (wsDefs ?? []) as MajorDef[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateByProject = new Map<string, any[]>()
  for (const s of (wsMajorState ?? [])) {
    const list = stateByProject.get(s.project_id)
    if (list) list.push(s)
    else stateByProject.set(s.project_id, [s])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (projects ?? []).map((p: any) => {
    const u = p.users
    const assignee_name = u?.full_name ?? undefined
    const assignee_avatar_url = u?.avatar_url ?? null
    const next = nextMilestone(
      defs,
      (milestonesByProject.get(p.id) ?? []) as Milestone[],
      stateByProject.get(p.id) ?? [],
    )
    // Mirror the Technical tab's rollup: sum the systems' size_kwdc when any exist,
    // otherwise fall back to the project's manually-entered system_kwdc.
    const systems = (p.systems ?? []) as { size_kwdc: number | null }[]
    const rollup_kwdc = systems.length > 0
      ? systems.reduce((s, x) => s + (x.size_kwdc ?? 0), 0)
      : (p.system_kwdc ?? 0)
    return {
      id: p.id,
      project_number: p.project_number,
      name: p.name,
      stage: p.stage,
      deal_health: p.deal_health,
      system_kwdc: rollup_kwdc,
      city: p.city,
      state: p.state,
      tranche: p.tranche,
      region: p.region,
      utility: p.utility,
      target_cod: p.target_cod,
      assignee_name,
      assignee_avatar_url,
      next_milestone: next?.label,
      next_milestone_date: next?.end ?? null,
    }
  })

  return <ProjectsClient projects={mapped} users={users ?? []} />
}
