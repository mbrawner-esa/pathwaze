import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient, type SettingsUser } from '@/components/settings/SettingsClient'

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
  return <SettingsClient user={profile} />
}
