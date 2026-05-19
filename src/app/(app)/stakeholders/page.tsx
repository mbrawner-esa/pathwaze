import { createClient } from '@/lib/supabase/server'
import { StakeholdersClient } from '@/components/stakeholders/StakeholdersClient'

export const dynamic = 'force-dynamic'

export default async function StakeholdersPage() {
  const supabase = await createClient()

  const [stakeholdersRes, projectsRes] = await Promise.all([
    supabase
      .from('stakeholders')
      .select('*, project:projects(name, project_number, tranche, city, state)')
      .order('name'),
    supabase.from('projects').select('id, name, project_number').order('name'),
  ])

  console.log('[stakeholders page] count:', stakeholdersRes.data?.length, 'error:', stakeholdersRes.error)
  if (stakeholdersRes.error) console.error('[stakeholders page] error detail:', stakeholdersRes.error)

  return <StakeholdersClient stakeholders={stakeholdersRes.data ?? []} projects={projectsRes.data ?? []} />
}
