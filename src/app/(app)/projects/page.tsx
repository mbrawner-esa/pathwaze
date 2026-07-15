import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/ProjectsClient'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: projects }, { data: users }] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        id, project_number, name, stage, deal_health, system_kwdc,
        city, state, tranche, region, assignee_id,
        utility, target_cod,
        users!assignee_id(full_name, avatar_url),
        milestones(label, completed, sort_order, target_date),
        systems(size_kwdc)
      `)
      // Archived projects are hidden program-wide. Admins can view them at /admin/archived.
      .neq('stage', 'Archived')
      .order('name') as unknown as { data: any[] | null },
    supabase.from('users').select('id, full_name').eq('status', 'active').order('full_name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (projects ?? []).map((p: any) => {
    const u = p.users
    const assignee_name = u?.full_name ?? undefined
    const assignee_avatar_url = u?.avatar_url ?? null
    const milestones = (p.milestones ?? []) as { label: string; completed: boolean; sort_order: number; target_date: string | null }[]
    const next = milestones
      .filter(m => !m.completed)
      .sort((a, b) => a.sort_order - b.sort_order)[0]
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
      next_milestone_date: next?.target_date ?? null,
    }
  })

  return <ProjectsClient projects={mapped} users={users ?? []} />
}
