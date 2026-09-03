import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { parseTokenMentions, emailUser } from '@/lib/rfi-notify'
import { appUrl } from '@/lib/slack'

/**
 * Comment thread on a milestone (migration 072).
 *
 * GET    ?milestone_id=…    → the thread, oldest first
 * POST   { milestone_id, body }
 * DELETE ?id=…              → remove my own comment
 *
 * This carries the instructions and context behind a piece of work — why it is
 * a focus, what "done" means, what changed since last week. Deliberately
 * separate from `milestones.notes`, which is a single body where the last
 * writer wins and a conversation would overwrite itself.
 */

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const milestoneId = new URL(request.url).searchParams.get('milestone_id')
  if (!milestoneId) {
    return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestone_comments') as any)
    .select('id, milestone_id, body, created_at, edited_at, user_id, users:user_id(full_name, avatar_url)')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { milestone_id, body } = await request.json() as {
    milestone_id?: string; body?: string
  }
  // Plain text with <@USERID> tokens, so a trim is the whole check.
  if (!milestone_id || !body?.trim()) {
    return NextResponse.json({ error: 'milestone_id and a non-empty body are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestone_comments') as any)
    .insert({ milestone_id, user_id: user.id, body })
    .select('id, milestone_id, body, created_at, edited_at, user_id, users:user_id(full_name, avatar_url)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Context for the activity feed. Best-effort: a failure here must not lose
  // the comment the user just wrote.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ms } = await (supabase.from('workstream_milestones') as any)
      .select('label, project_id, major_key').eq('id', milestone_id).single()

    if (ms) {
      await logActivity(supabase, user, {
        entity_type: 'workstream_milestone',
        entity_id: milestone_id,
        action: 'commented',
        project_id: ms.project_id,
        metadata: { label: ms.label, major_key: ms.major_key },
      })

      // The composer is MentionInput, matching task threads, so mentions arrive
      // as <@USERID> tokens — parseTokenMentions, not the rich-text parser.
      const mentioned = parseTokenMentions(body).filter(id => id !== user.id)
      for (const id of mentioned) {
        // eslint-disable-next-line no-await-in-loop
        await emailUser(supabase, id, {
          subject: `You were mentioned on ${ms.label}`,
          heading: 'Mentioned in a milestone comment',
          message: body,
          ctaLabel: 'Open Portfolio Health',
          ctaUrl: appUrl('/health'),
        })
      }
    }
  } catch (e) {
    console.warn('[milestone-comments] post-insert notify failed:', e)
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // RLS already restricts this to the author; the filter states the intent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_comments') as any)
    .delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

/** PATCH — edit my own comment. RLS refuses anyone else's. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, body } = await request.json() as { id?: string; body?: string }
  if (!id || !body?.trim()) {
    return NextResponse.json({ error: 'id and a non-empty body are required' }, { status: 400 })
  }

  // edited_at is stamped server-side so the marker cannot be spoofed or omitted
  // by a client that forgets to send it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestone_comments') as any)
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id)
    .select('id, milestone_id, body, created_at, edited_at, user_id, users:user_id(full_name, avatar_url)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}
