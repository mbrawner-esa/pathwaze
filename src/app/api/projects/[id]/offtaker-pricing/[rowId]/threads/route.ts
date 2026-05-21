import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rowId } = await params
  const { data, error } = await supabase
    .from('offtaker_pricing_threads')
    .select('*')
    .eq('row_id', rowId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rowId } = await params
  const body = await req.json()
  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Resolve the poster's display name + avatar so threads render without a join later.
  const { data: profile } = await supabase.from('users').select('full_name, avatar_url').eq('id', user.id).single() as { data: { full_name?: string; avatar_url?: string | null } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('offtaker_pricing_threads') as any)
    .insert({
      row_id: rowId,
      user_id: user.id,
      user_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'User',
      user_avatar_url: profile?.avatar_url ?? null,
      message: body.message.trim(),
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
