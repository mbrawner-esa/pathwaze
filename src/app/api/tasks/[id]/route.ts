import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendDM, replyInThread, taskAssignedBlocks, taskStatusChangedBlocks } from '@/lib/slack'
import { sendTaskAssignedEmail, sendTaskCompletedEmail } from '@/lib/email'

const TRACKED_FIELDS = ['status', 'priority', 'assignee_id', 'approver_id', 'approval_status', 'due_date', 'title']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Fetch existing task so we can diff for activity log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('tasks') as any).select('*').eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tasks') as any).update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Write activity_log entries for each tracked field that changed
  if (before) {
    // Resolve user names for assignee/approver changes (small extra query, only when needed)
    const userIdsToResolve: string[] = []
    for (const field of ['assignee_id', 'approver_id']) {
      if (TRACKED_FIELDS.includes(field) && body[field] !== undefined && before[field] !== body[field]) {
        if (before[field]) userIdsToResolve.push(before[field])
        if (body[field]) userIdsToResolve.push(body[field])
      }
    }
    const idToName: Record<string, string> = {}
    if (userIdsToResolve.length) {
      const { data: usrs } = await supabase.from('users').select('id, full_name').in('id', userIdsToResolve)
      ;(usrs ?? []).forEach((u: { id: string; full_name: string }) => { idToName[u.id] = u.full_name })
    }

    const entries: Array<{ entity_type: string; entity_id: string; action: string; user_id: string; metadata: Record<string, unknown> }> = []
    for (const field of TRACKED_FIELDS) {
      if (body[field] === undefined) continue
      if (before[field] === body[field]) continue
      const action = `${field}_changed`
      const metadata: Record<string, unknown> = { field, from: before[field], to: body[field] }
      if (field === 'assignee_id' || field === 'approver_id') {
        metadata.from_name = before[field] ? idToName[before[field]] : null
        metadata.to_name = body[field] ? idToName[body[field]] : null
      }
      entries.push({
        entity_type: 'task',
        entity_id: id,
        action,
        user_id: user.id,
        metadata,
      })
    }
    if (entries.length) {
      // Ensure a public.users row exists for the auth user (FK requirement)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('users') as any).upsert({
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: 'team',
      }, { onConflict: 'id', ignoreDuplicates: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_log') as any).insert(entries)
    }
  }

  // ── Slack notifications ──
  try {
    const actorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
    const newAssigneeId = body.assignee_id !== undefined ? body.assignee_id : before?.assignee_id
    const wasReassigned = body.assignee_id !== undefined && before?.assignee_id !== body.assignee_id
    const statusChanged = body.status !== undefined && before?.status !== body.status
    // Dev toggle: set SLACK_DM_SELF=true in .env.local to DM yourself for testing.
    const allowSelfDM = process.env.SLACK_DM_SELF === 'true'
    const notSelf = (id: string | null | undefined) => !!id && (allowSelfDM || id !== user.id)

    console.log('[slack] task PATCH', {
      taskId: id,
      actor: user.id,
      newAssigneeId,
      wasReassigned,
      statusChanged,
      skipReason:
        !wasReassigned && !statusChanged ? 'no relevant change' :
        !newAssigneeId ? 'no assignee' :
        newAssigneeId === user.id ? 'assignee is actor (self-skip)' :
        null,
    })

    let projectName = ''
    if (data.project_id) {
      const { data: proj } = await supabase.from('projects').select('name').eq('id', data.project_id).single()
      projectName = (proj as { name?: string } | null)?.name ?? ''
    }
    const taskPath = `/tasks?id=${id}`

    // Check recipient's notification preferences before sending Slack DMs
    let recipientPrefs: { notify_slack_task_assigned?: boolean; notify_slack_task_status?: boolean } = {}
    if (newAssigneeId && notSelf(newAssigneeId)) {
      const { data: r } = await supabase.from('users').select('notify_slack_task_assigned, notify_slack_task_status').eq('id', newAssigneeId).single() as { data: typeof recipientPrefs | null }
      recipientPrefs = r ?? {}
    }

    if (wasReassigned && newAssigneeId && notSelf(newAssigneeId) && recipientPrefs.notify_slack_task_assigned !== false) {
      const { text, blocks } = taskAssignedBlocks({
        title: data.title, projectName, dueDate: data.due_date, priority: data.priority,
        type: data.type, description: data.description, assignedBy: actorName, taskPath,
      })
      const r = await sendDM(supabase, newAssigneeId, text, blocks)
      console.log('[slack] task assigned DM result:', r)
      // Anchor the task's thread to this new DM so future Pathwaze comments reply here
      if (r.ok && r.channel && r.ts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('tasks') as any)
          .update({ slack_dm_channel: r.channel, slack_dm_ts: r.ts })
          .eq('id', id)
      }
    }

    if (statusChanged && newAssigneeId && notSelf(newAssigneeId) && recipientPrefs.notify_slack_task_status !== false) {
      const { text, blocks } = taskStatusChangedBlocks({
        title: data.title, projectName, from: before.status, to: body.status,
        changedBy: actorName, taskPath,
      })
      // If we have a DM anchor, post status update as a thread reply (keeps convo in one place).
      // Otherwise send a fresh DM and anchor the task to it.
      if (data.slack_dm_channel && data.slack_dm_ts) {
        const r = await replyInThread(data.slack_dm_channel, data.slack_dm_ts, text, blocks)
        console.log('[slack] task status thread reply result:', r)
      } else {
        const r = await sendDM(supabase, newAssigneeId, text, blocks)
        console.log('[slack] task status DM result:', r)
        if (r.ok && r.channel && r.ts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('tasks') as any)
            .update({ slack_dm_channel: r.channel, slack_dm_ts: r.ts })
            .eq('id', id)
        }
      }
    }
  } catch (e) {
    console.warn('[slack] task notify failed:', e)
  }

  // ── Email notifications ──
  // Fire-and-forget. Mirrors the Slack DM logic but uses email-specific
  // preferences (notify_email_task_assigned / notify_email_task_complete).
  try {
    const actorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'A teammate'
    const newAssigneeId = body.assignee_id !== undefined ? body.assignee_id : before?.assignee_id
    const wasReassigned = body.assignee_id !== undefined && before?.assignee_id !== body.assignee_id
    const statusChanged = body.status !== undefined && before?.status !== body.status
    const completedNow = statusChanged && body.status === 'Complete'
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
    const taskUrl = `${origin}/tasks?id=${id}`

    let projectName: string | null = null
    if (data.project_id) {
      const { data: proj } = await supabase.from('projects').select('name').eq('id', data.project_id).single()
      projectName = (proj as { name?: string } | null)?.name ?? null
    }

    // (a) Re-assigned → email the new assignee
    if (wasReassigned && newAssigneeId && newAssigneeId !== user.id) {
      const { data: a } = await supabase
        .from('users')
        .select('email, full_name, notify_email_task_assigned')
        .eq('id', newAssigneeId)
        .single() as { data: { email?: string; full_name?: string; notify_email_task_assigned?: boolean } | null }
      if (a?.email && a.notify_email_task_assigned !== false) {
        sendTaskAssignedEmail({
          to: a.email,
          recipientName: a.full_name || a.email,
          taskTitle: data.title,
          taskDescription: data.description,
          projectName,
          dueDate: data.due_date,
          priority: data.priority,
          type: data.type,
          assignerName: actorName,
          taskUrl,
        }).catch(e => console.error('[task PATCH] assigned email failed:', e))
      }
    }

    // (b) Status → Complete → email the task creator (if not the actor)
    if (completedNow && data.created_by && data.created_by !== user.id) {
      const { data: c } = await supabase
        .from('users')
        .select('email, full_name, notify_email_task_complete')
        .eq('id', data.created_by)
        .single() as { data: { email?: string; full_name?: string; notify_email_task_complete?: boolean } | null }
      if (c?.email && c.notify_email_task_complete !== false) {
        sendTaskCompletedEmail({
          to: c.email,
          recipientName: c.full_name || c.email,
          taskTitle: data.title,
          projectName,
          completerName: actorName,
          taskUrl,
        }).catch(e => console.error('[task PATCH] completed email failed:', e))
      }
    }
  } catch (e) {
    console.warn('[email] task notify failed:', e)
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
