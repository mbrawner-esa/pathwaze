import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendTaskAssignedEmail, shouldEmailNotify } from '@/lib/email'
import { parseMentions, emailUser } from '@/lib/rfi-notify'
import { appUrl } from '@/lib/slack'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const visibility = body.visibility === 'private' ? 'private' : 'public'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tasks') as any).insert({
    project_id: body.project_id,
    title: body.title,
    description: body.description || null,
    type: body.type || 'Administrative',
    status: 'Draft',
    priority: body.priority || 'Medium',
    assignee_id: body.assignee_id || null,
    approver_id: body.approver_id || null,
    requires_approval: body.requires_approval || false,
    due_date: body.due_date || null,
    visibility,
    parent_task_id: body.parent_task_id || null,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Email notification: task assigned ──
  // Fire-and-forget — never fail the API request if email send fails.
  // Private tasks don't notify anyone (they're personal reminders — even if
  // an assignee is set, that user can't view the task because they're not
  // the creator).
  if (data.visibility !== 'private' && shouldEmailNotify(data.assignee_id, user.id)) {
    notifyTaskAssigned(supabase, data, user.id).catch(e =>
      console.error('[task POST] task-assigned email failed:', e)
    )
  }

  // @-mentions in the task description → email each mentioned user (best-effort).
  // Skipped for private tasks (only the creator can see them).
  if (data.visibility !== 'private' && data.description) {
    const mentioned = parseMentions(data.description).filter((uid: string) => uid !== user.id)
    for (const uid of mentioned) {
      emailUser(supabase, uid, {
        subject: `You were mentioned on a task`, heading: 'You were mentioned',
        message: `You were mentioned on the task <b>${data.title}</b>.`,
        ctaLabel: 'Open task', ctaUrl: appUrl(`/tasks?id=${data.id}`),
      }).catch(e => console.error('[task POST] mention email failed:', e))
    }
  }

  return NextResponse.json(data)
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
