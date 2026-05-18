import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminUsersClient, type AdminUserRow } from '@/components/admin/AdminUsersClient'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((me as { role?: string } | null)?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, role, status, avatar_url, created_at')
    .order('created_at', { ascending: false }) as unknown as { data: AdminUserRow[] | null }

  const { data: invites } = await supabase
    .from('invited_emails')
    .select('email, role, invited_at, accepted_at')
    .order('invited_at', { ascending: false }) as unknown as { data: { email: string; role: string; invited_at: string; accepted_at: string | null }[] | null }

  return <AdminUsersClient users={users ?? []} pendingInvites={(invites ?? []).filter(i => !i.accepted_at)} />
}
