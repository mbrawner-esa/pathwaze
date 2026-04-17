import { createClient } from '@/lib/supabase/server'
import { ProjectsClient } from '@/components/projects/ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, project_number, name, stage, deal_health, system_kwdc,
      city, state, tranche, region, assignee_id,
      users!assignee_id(full_name),
      milestones(label, completed, sort_order)
    `)
    .order('name') as unknown as { data: any[] | null }

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
      assignee_name,
      next_milestone: next?.label,
    }
  })

  return <ProjectsClient projects={mapped} />
}
