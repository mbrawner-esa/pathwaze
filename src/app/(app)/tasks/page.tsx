import { createClient } from '@/lib/supabase/server'
import { TasksClient } from '@/components/tasks/TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()

  const [{ data: tasks }, { data: projects }, { data: users }] = await Promise.all([
    supabase.from('tasks').select('*, assignee:users!assignee_id(full_name, avatar_url), approver:users!approver_id(full_name, avatar_url), project:projects(name, project_number)').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name, project_number').order('name'),
    supabase.from('users').select('id, full_name, avatar_url'),
  ])

  return <TasksClient tasks={tasks ?? []} projects={projects ?? []} users={users ?? []} />
}
