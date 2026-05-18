import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { replyInThread } from '@/lib/slack'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('task_threads')
    .select('*, user:users(full_name)')
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
    .select('*, user:users(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Mirror the comment into the linked Slack DM thread (if any) ──
  try {
    const { data: task } = await supabase
      .from('tasks')
      .select('slack_dm_channel, slack_dm_ts')
      .eq('id', id)
      .single() as { data: { slack_dm_channel: string | null; slack_dm_ts: string | null } | null }

    if (task?.slack_dm_channel && task?.slack_dm_ts) {
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

  return NextResponse.json(data)
}
