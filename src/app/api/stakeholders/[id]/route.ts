import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TRACKED_FIELDS = ['name', 'title', 'department', 'role', 'email', 'phone', 'sentiment', 'is_primary', 'org', 'project_id']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Fetch existing for diff
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('stakeholders') as any).select('*').eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('stakeholders') as any).update(body).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Activity log
  if (before) {
    const entries: Array<{ entity_type: string; entity_id: string; action: string; user_id: string; metadata: Record<string, unknown> }> = []
    for (const field of TRACKED_FIELDS) {
      if (body[field] === undefined) continue
      if (before[field] === body[field]) continue
      entries.push({
        entity_type: 'stakeholder',
        entity_id: id,
        action: `${field}_changed`,
        user_id: user.id,
        metadata: { field, from: before[field], to: body[field] },
      })
    }
    if (entries.length) {
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

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase.from('stakeholders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
