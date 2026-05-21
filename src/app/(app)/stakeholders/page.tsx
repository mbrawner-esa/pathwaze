import { createClient } from '@/lib/supabase/server'
import { StakeholdersClient } from '@/components/stakeholders/StakeholdersClient'

export const dynamic = 'force-dynamic'

export default async function StakeholdersPage() {
  const supabase = await createClient()

  const [{ data: stakeholders }, { data: projects }] = await Promise.all([
    supabase
      .from('stakeholders')
      // Use the explicit FK alias to disambiguate from projects.primary_stakeholder_id
      .select('*, project:projects!stakeholders_project_id_fkey(name, project_number, tranche, city, state)')
      .order('name'),
    supabase.from('projects').select('id, name, project_number').neq('stage', 'Archived').order('name'),
  ])

  return <StakeholdersClient stakeholders={stakeholders ?? []} projects={projects ?? []} />
}
