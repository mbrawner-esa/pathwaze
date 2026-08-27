import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Edit / delete one message in a task thread.
//
// Author-scoped: you can revise or remove your own message, and admins can
// remove anyone's. RLS on task_threads is FOR ALL over the whole task, so it
// cannot express "own row only" — this route is the authorship boundary and
// every write below re-filters on user_id for exactly that reason.
//
// Slack mirroring is deliberately one-way: the original comment may already
// have been posted into the task's DM thread, and Slack has no edit-by-proxy
// for a bot message we didn't keep a ts for. The in-app thread is the record;
// an edited message shows an "edited" marker so the two are never silently
// out of step.

async function loadActor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: row } = await supabase
    .from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
  return { id: user.id, role: row?.role ?? 'team' }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const supabase = await createClient()
  const actor = await loadActor(supabase)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params
  const { message } = await req.json()
  if (typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Only the author may edit — an admin can delete someone's message but not
  // put words in their mouth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('task_threads') as any)
    .update({ message: message.trim(), edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('task_id', id)
    .eq('user_id', actor.id)
    .select('*, user:users(full_name, avatar_url)')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not your message' }, { status: 403 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const supabase = await createClient()
  const actor = await loadActor(supabase)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, commentId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('task_threads') as any).delete().eq('id', commentId).eq('task_id', id)
  if (actor.role !== 'admin') q = q.eq('user_id', actor.id)

  const { data, error } = await q.select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not your message' }, { status: 403 })
  return NextResponse.json({ success: true })
}
