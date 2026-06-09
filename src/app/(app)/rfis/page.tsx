import { createClient } from '@/lib/supabase/server'
import { RfisClient } from '@/components/rfis/RfisClient'

export const dynamic = 'force-dynamic'

export default async function RfisPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: rfis }, { data: projects }, { data: users }] = await Promise.all([
    (supabase.from('rfis') as any)
      .select('*, project:projects(id, name, project_number), ball_user:users!ball_in_court_user_id(id, full_name), ball_sh:stakeholders!ball_in_court_stakeholder_id(id, name), manager:users!rfi_manager_id(id, full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, project_number').neq('stage', 'Archived').order('name'),
    supabase.from('users').select('id, full_name').eq('status', 'active').order('full_name'),
  ])

  return <RfisClient rfis={rfis ?? []} projects={projects ?? []} users={users ?? []} />
}
