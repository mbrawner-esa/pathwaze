import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { replyInThread, appUrl } from '@/lib/slack'
import { logActivity } from '@/lib/activity'
import { parseTokenMentions, emailUser } from '@/lib/rfi-notify'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('task_threads')
    .select('*, user:users(full_name, avatar_url)')
    .eq('task_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { message } = await req.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('task_threads') as any)
    .insert({ task_id: id, user_id: user.id, message })
    .select('*, user:users(full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Mirror the comment into the linked Slack DM thread (if any) ──
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select('slack_dm_channel, slack_dm_ts, assignee_id')
      .eq('id', id)
      .single() as { data: { slack_dm_channel: string | null; slack_dm_ts: string | null; assignee_id: string | null } | null }

    // Skip if the assignee has thread DMs turned off (they own this DM thread)
    let allowed = true
    if (task?.assignee_id) {
      const { data: r } = await supabase.from('users').select('notify_slack_task_threads').eq('id', task.assignee_id).single() as { data: { notify_slack_task_threads?: boolean } | null }
      if (r?.notify_slack_task_threads === false) allowed = false
    }

    if (allowed && task?.slack_dm_channel && task?.slack_dm_ts) {
      const authorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
      const r = await replyInThread(
        task.slack_dm_channel,
        task.slack_dm_ts,
        `${authorName}: ${message}`,
        [{ type: 'section', text: { type: 'mrkdwn', text: `*${authorName}*\n${message}` } }],
      )
      console.log('[slack] task comment thread reply:', r)
    }
  } catch (e) {
    console.warn('[slack] task comment notify failed:', e)
  }

  // ── @-mentions in the comment → notify each mentioned user (feed + email) ──
  // Skip self-mentions and private tasks (their threads shouldn't fan out).
  try {
    const mentioned = parseTokenMentions(message).filter(uid => uid !== user.id)
    if (mentioned.length) {
      const { data: t } = await supabase
        .from('tasks')
        .select('title, visibility, project_id')
        .eq('id', id)
        .single() as { data: { title?: string | null; visibility?: string | null; project_id?: string | null } | null }
      if (t?.visibility !== 'private') {
        const taskUrl = appUrl(`/tasks?id=${id}`)
        for (const uid of mentioned) {
          await logActivity(supabase, user, { entity_type: 'task', entity_id: id, action: 'mentioned you in a comment', project_id: t?.project_id ?? null, metadata: { mentioned_user_id: uid } })
          await emailUser(supabase, uid, { subject: 'You were mentioned in a task comment', heading: 'You were mentioned', message: `You were mentioned in a comment on task${t?.title ? ` <b>${t.title}</b>` : ''}.`, ctaLabel: 'Open task', ctaUrl: taskUrl })
        }
      }
    }
  } catch (e) {
    console.warn('[mentions] task comment notify failed:', e)
  }

  return NextResponse.json(data)
}
