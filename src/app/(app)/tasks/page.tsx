import { createClient } from '@/lib/supabase/server'
import { TasksClient } from '@/components/tasks/TasksClient'
import { redirect } from 'next/navigation'
import { isManagerOrAbove } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch current user's role + subscriptions for visibility/type filtering.
  const { data: me } = await supabase
    .from('users')
    .select('role, subscribed_task_types')
    .eq('id', user.id)
    .single() as { data: { role?: string; subscribed_task_types?: string[] | null } | null }
  const role = me?.role ?? 'team'
  const subscribedTypes = me?.subscribed_task_types ?? []

  // Tasks query: hide other users' private tasks (handled by .or below).
  // A private task is only visible to whoever set visibility='private' (the creator).
  // Type-subscription filtering for team-role users is applied post-fetch (small dataset).
  const [{ data: tasks }, { data: projects }, { data: users }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, assignee:users!assignee_id(full_name, avatar_url), approver:users!approver_id(full_name, avatar_url), project:projects(name, project_number)')
      .or(`visibility.eq.public,created_by.eq.${user.id}`)
      .order('created_at', { ascending: false }),
    // Archived projects hidden from the project picker; see /admin/archived for recovery.
    supabase.from('projects').select('id, name, project_number').neq('stage', 'Archived').order('name'),
    supabase.from('users').select('id, full_name, avatar_url').eq('status', 'active'),
  ])

  // Type-subscription filter for team-role users.
  // Admins + managers see everything; team users only see tasks of subscribed types
  // (PLUS tasks they're directly involved in — created/assignee/approver — regardless of type).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredTasks = isManagerOrAbove(role)
    ? (tasks ?? [])
    : (tasks ?? []).filter((t: any) => {
        if (t.created_by === user.id) return true
        if (t.assignee_id === user.id) return true
        if (t.approver_id === user.id) return true
        return subscribedTypes.includes(t.type)
      })

  return <TasksClient tasks={filteredTasks} projects={projects ?? []} users={users ?? []} />
}
