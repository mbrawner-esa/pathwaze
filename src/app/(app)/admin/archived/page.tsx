import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArchivedProjectsClient, type ArchivedProjectRow } from '@/components/admin/ArchivedProjectsClient'

export const dynamic = 'force-dynamic'

export default async function AdminArchivedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((me as { role?: string } | null)?.role !== 'admin') redirect('/dashboard')

  const { data: projects } = await supabase
    .from('projects')
    .select('id, project_number, name, stage, customer, city, state, tranche, system_kwdc, target_cod, archived_at, created_at')
    .eq('stage', 'Archived')
    .order('archived_at', { ascending: false }) as unknown as { data: ArchivedProjectRow[] | null }

  return <ArchivedProjectsClient projects={projects ?? []} />
}
