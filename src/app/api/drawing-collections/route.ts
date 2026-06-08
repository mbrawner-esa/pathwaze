import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/drawing-collections → list active collections (with owner)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawing_collections') as any)
    .select('*, owner:users!owner_id(id, full_name, avatar_url)')
    .eq('is_active', true)
    .order('sort_order')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/drawing-collections → create a new collection { name, owner_id?, action_plan_id? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase.from('drawing_collections') as any)
    .select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sort_order = (maxRow?.sort_order ?? -1) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawing_collections') as any)
    .insert({
      name,
      owner_id: body.owner_id ?? null,
      action_plan_id: body.action_plan_id ?? null,
      sort_order,
      created_by: user.id,
    })
    .select('*, owner:users!owner_id(id, full_name, avatar_url)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
