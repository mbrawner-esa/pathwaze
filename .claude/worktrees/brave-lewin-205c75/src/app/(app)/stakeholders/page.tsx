import { createClient } from '@/lib/supabase/server'
import { StakeholdersClient } from '@/components/stakeholders/StakeholdersClient'

export default async function StakeholdersPage() {
  const supabase = await createClient()

  const [{ data: stakeholders }, { data: projects }] = await Promise.all([
    supabase
      .from('stakeholders')
      .select('*, project:projects(name, project_number, tranche, city, state)')
      .order('name'),
    supabase.from('projects').select('id, name, project_number').order('name'),
  ])

  return <StakeholdersClient stakeholders={stakeholders ?? []} projects={projects ?? []} />
}
