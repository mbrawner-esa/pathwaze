import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { RfiDetailClient } from '@/components/rfis/RfiDetailClient'

export const dynamic = 'force-dynamic'

export default async function RfiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rfi } = await (supabase.from('rfis') as any)
    .select('*, project:projects(id, name, project_number), ball_user:users!ball_in_court_user_id(id, full_name), ball_sh:stakeholders!ball_in_court_stakeholder_id(id, name), manager:users!rfi_manager_id(id, full_name), area:buildings(id, name), drawing:drawings(id, file_name), received_user:users!received_from_user_id(id, full_name), received_sh:stakeholders!received_from_stakeholder_id(id, name)')
    .eq('id', id).maybeSingle()
  if (!rfi) notFound()

  const pid = rfi.project_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: responses }, { data: distribution }, { data: users }, { data: links },
         { data: buildings }, { data: systems }, { data: stakeholders }, { data: drawings }] = await Promise.all([
    (supabase.from('rfi_responses') as any).select('*, author:users!author_id(id, full_name, avatar_url), files:rfi_response_files(id, file_name, storage_path, content_type)').eq('rfi_id', id).order('created_at'),
    (supabase.from('rfi_distribution') as any).select('*, user:users!user_id(id, full_name), stakeholder:stakeholders!stakeholder_id(id, name)').eq('rfi_id', id),
    supabase.from('users').select('id, full_name').eq('status', 'active').order('full_name'),
    (supabase.from('rfi_links') as any).select('*').eq('rfi_id', id).order('created_at'),
    supabase.from('buildings').select('id, name, category').eq('project_id', pid).order('name'),
    (supabase.from('systems') as any).select('*').eq('project_id', pid),
    supabase.from('stakeholders').select('id, name, role').eq('project_id', pid).order('name'),
    (supabase.from('drawings') as any).select('id, file_name, area_id, discipline_key').eq('project_id', pid).order('file_name'),
  ])

  // Meters hang off buildings; fetch by the project's building ids.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildingIds = ((buildings ?? []) as any[]).map(b => b.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let meters: any[] = []
  if (buildingIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: m } = await (supabase.from('meters') as any).select('*').in('building_id', buildingIds)
    meters = m ?? []
  }

  const catalog = {
    building: buildings ?? [], meter: meters, system: systems ?? [],
    stakeholder: stakeholders ?? [], drawing: drawings ?? [],
  }

  return <RfiDetailClient rfi={rfi} responses={responses ?? []} distribution={distribution ?? []}
    users={users ?? []} links={links ?? []} catalog={catalog} />
}
