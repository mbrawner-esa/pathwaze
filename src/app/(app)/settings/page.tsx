import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { SettingsClient, type SettingsUser, type OutlookStatus } from '@/components/settings/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role, status, avatar_url, timezone, timezone_label, title, slack_display_name, profile_synced_at, notify_slack_task_assigned, notify_slack_task_status, notify_slack_task_threads, notify_email_task_assigned, notify_email_task_complete, subscribed_task_types')
    .eq('id', user.id)
    .single() as unknown as { data: SettingsUser | null }

  if (!profile) redirect('/auth/login')

  // Outlook connection status — read via the service client so we never expose
  // token columns to the RLS-scoped session (only safe fields are selected).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (serviceClient().from('email_connections') as any)
    .select('account_email, connected_at, last_synced_at, last_error')
    .eq('user_id', user.id)
    .maybeSingle()

  const outlook: OutlookStatus = conn
    ? { connected: true, accountEmail: conn.account_email ?? null, lastSyncedAt: conn.last_synced_at ?? null, lastError: conn.last_error ?? null }
    : { connected: false, accountEmail: null, lastSyncedAt: null, lastError: null }

  return <SettingsClient user={profile} outlook={outlook} />
}
