import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Threads section for stakeholders is backed by stakeholder_feed (type='comment' or 'thread').
// Slack-sourced messages (when wired) will land here too with type='slack'.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('stakeholder_feed')
    .select('id, type, date, user_name, text, subject')
    .eq('stakeholder_id', id)
    .in('type', ['comment', 'thread', 'slack'])
    .order('date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { message } = await req.json()
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('stakeholder_feed') as any)
    .insert({
      stakeholder_id: id,
      type: 'comment',
      date: new Date().toISOString(),
      user_name: userName,
      text: message.trim(),
    })
    .select('id, type, date, user_name, text, subject')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
