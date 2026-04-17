import { createClient } from '@/lib/supabase/server'
import { StakeholdersClient } from '@/components/stakeholders/StakeholdersClient'

export default async function StakeholdersPage() {
  const supabase = await createClient()

  const { data: stakeholders } = await supabase
    .from('stakeholders')
    .select('*, project:projects(name, project_number, tranche, city, state)')
    .order('name')

  return <StakeholdersClient stakeholders={stakeholders ?? []} />
}
