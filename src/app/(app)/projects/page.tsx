import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/ProjectsClient'

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const supabase = await createClient()
  const { archived } = await searchParams
  const showArchived = archived === '1'

  let query = supabase
    .from('projects')
    .select(`
      id, project_number, name, stage, deal_health, system_kwdc,
      city, state, tranche, region, assignee_id, archived_at,
      utility, target_cod,
      users!assignee_id(full_name),
      milestones(label, completed, sort_order)
    `)
    .order('name')

  if (!showArchived) {
    query = query.is('archived_at', null)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: projects }, { data: users }] = await Promise.all([
    query as unknown as { data: any[] | null },
    supabase.from('users').select('id, full_name').order('full_name'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = (projects ?? []).map((p: any) => {
    const u = p.users
    const assignee_name = u?.full_name ?? undefined
    const milestones = (p.milestones ?? []) as { label: string; completed: boolean; sort_order: number }[]
    const next = milestones
      .filter(m => !m.completed)
      .sort((a, b) => a.sort_order - b.sort_order)[0]
    return {
      id: p.id,
      project_number: p.project_number,
      name: p.name,
      stage: p.stage,
      deal_health: p.deal_health,
      system_kwdc: p.system_kwdc,
      city: p.city,
      state: p.state,
      tranche: p.tranche,
      region: p.region,
      utility: p.utility,
      target_cod: p.target_cod,
      assignee_name,
      next_milestone: next?.label,
      archived_at: p.archived_at ?? null,
    }
  })

  return <ProjectsClient projects={mapped} users={users ?? []} showArchived={showArchived} />
}
