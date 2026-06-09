import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RfiDetailClient } from '@/components/rfis/RfiDetailClient'

export const dynamic = 'force-dynamic'

export default async function RfiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rfi } = await (supabase.from('rfis') as any)
    .select('*, project:projects(id, name, project_number), ball_user:users!ball_in_court_user_id(id, full_name), ball_sh:stakeholders!ball_in_court_stakeholder_id(id, name), manager:users!rfi_manager_id(id, full_name), area:buildings(id, name), drawing:drawings(id, file_name)')
    .eq('id', id).maybeSingle()
  if (!rfi) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: responses }, { data: distribution }, { data: users }] = await Promise.all([
    (supabase.from('rfi_responses') as any).select('*, author:users!author_id(id, full_name)').eq('rfi_id', id).order('created_at'),
    (supabase.from('rfi_distribution') as any).select('*, user:users!user_id(id, full_name), stakeholder:stakeholders!stakeholder_id(id, name)').eq('rfi_id', id),
    supabase.from('users').select('id, full_name').eq('status', 'active').order('full_name'),
  ])

  return <RfiDetailClient rfi={rfi} responses={responses ?? []} distribution={distribution ?? []} users={users ?? []} />
}
