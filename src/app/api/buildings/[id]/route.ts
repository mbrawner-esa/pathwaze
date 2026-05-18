import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('buildings') as any)
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, user, { entity_type: 'building', entity_id: id, action: 'updated', project_id: data.project_id, metadata: { name: data.name } })
  return NextResponse.json({ building: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Fetch project_id + name for the log entry before delete
  const { data: before } = await supabase.from('buildings').select('project_id, name').eq('id', id).single()
  const { error } = await supabase.from('buildings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (before) await logActivity(supabase, user, { entity_type: 'building', entity_id: id, action: 'deleted', project_id: before.project_id, metadata: { name: before.name } })
  return NextResponse.json({ success: true })
}
