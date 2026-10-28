// Shared helper for creating tasks.
//
// Extracted verbatim from api/tasks/route.ts so the route and the MCP server
// (api/mcp) create tasks through one code path rather than two that drift.
// Behaviour is unchanged: insert as Draft, email the assignee, then notify
// anyone @-mentioned in the description.
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { sendTaskAssignedEmail, shouldEmailNotify } from './email'
import { parseMentions, emailUser } from './rfi-notify'
import { appUrl } from './slack'

// The enums live in task-types.ts (no dependencies) so client components can
// import them without pulling Resend and Slack into the browser bundle.
export { TASK_TYPES, TASK_PRIORITIES } from './task-types'
export type { TaskType, TaskPriority } from './task-types'

export interface NewTaskInput {
  project_id?: string | null
  title: string
  /** Storage-ready HTML. MCP callers pass markdown through richtext.ts first. */
  description?: string | null
  type?: string
  priority?: string
  assignee_id?: string | null
  approver_id?: string | null
  requires_approval?: boolean
  due_date?: string | null
  visibility?: string
  parent_task_id?: string | null
  workstream_milestone_id?: string | null
  /** 'mcp' when created by the connector; null from the app. */
  created_via?: string | null
}

/**
 * Create a task and run its notifications.
 *
 * Status is always 'Draft' — the app has never let a caller choose, and
 * Draft is the first kanban column rather than a hidden state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createTask(supabase: SupabaseClient<any>, user: User, input: NewTaskInput) {
  const visibility = input.visibility === 'private' ? 'private' : 'public'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tasks') as any)
    .insert({
      project_id: input.project_id || null,
      title: input.title,
      description: input.description || null,
      type: input.type || 'Administrative',
      status: 'Draft',
      priority: input.priority || 'Medium',
      assignee_id: input.assignee_id || null,
      approver_id: input.approver_id || null,
      requires_approval: input.requires_approval || false,
      due_date: input.due_date || null,
      visibility,
      parent_task_id: input.parent_task_id || null,
      // Set when the task is created from a Workstreams milestone. Nullable and
      // ignored by every other caller.
      workstream_milestone_id: input.workstream_milestone_id || null,
      created_by: user.id,
      created_via: input.created_via ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // ── Email notification: task assigned ──
  // Fire-and-forget — never fail the caller if email send fails.
  // Private tasks don't notify anyone (they're personal reminders — even if
  // an assignee is set, that user can't view the task because they're not
  // the creator).
  if (data.visibility !== 'private' && shouldEmailNotify(data.assignee_id, user.id)) {
    notifyTaskAssigned(supabase, data, user.id).catch((e) =>
      console.error('[createTask] task-assigned email failed:', e)
    )
  }

  // @-mentions in the task description → email each mentioned user (best-effort).
  // Skipped for private tasks (only the creator can see them).
  if (data.visibility !== 'private' && data.description) {
    const mentioned = parseMentions(data.description).filter((uid: string) => uid !== user.id)
    for (const uid of mentioned) {
      emailUser(supabase, uid, {
        subject: `You were mentioned on a task`,
        heading: 'You were mentioned',
        message: `You were mentioned on the task <b>${data.title}</b>.`,
        ctaLabel: 'Open task',
        ctaUrl: appUrl(`/tasks?id=${data.id}`),
      }).catch((e) => console.error('[createTask] mention email failed:', e))
    }
  }

  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyTaskAssigned(supabase: any, task: any, actorId: string) {
  // Fetch assignee email + pref, assigner name, project name in parallel.
  const [{ data: assignee }, { data: actor }, projectRes] = await Promise.all([
    supabase.from('users').select('email, full_name, notify_email_task_assigned').eq('id', task.assignee_id).single(),
    supabase.from('users').select('full_name, email').eq('id', actorId).single(),
    task.project_id
      ? supabase.from('projects').select('name').eq('id', task.project_id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!assignee?.email) return
  if (assignee.notify_email_task_assigned === false) return

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://pathwaze.esa-solar.com'
  const taskUrl = `${origin}/tasks?id=${task.id}`
  const assignerName = actor?.full_name || actor?.email?.split('@')[0] || 'A teammate'

  await sendTaskAssignedEmail({
    to: assignee.email,
    recipientName: assignee.full_name || assignee.email,
    taskTitle: task.title,
    taskDescription: task.description,
    projectName: projectRes?.data?.name ?? null,
    dueDate: task.due_date,
    priority: task.priority,
    type: task.type,
    assignerName,
    taskUrl,
  })
}
