import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ENTITY_TYPES = ['project', 'building', 'meter', 'system', 'permit', 'stakeholder', 'drawing'] as const

// GET /api/rfis/[id]/links → raw link rows
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('rfi_links') as any).select('*').eq('rfi_id', id).order('created_at')
  return NextResponse.json(data ?? [])
}

// POST /api/rfis/[id]/links → { entity_type, entity_id }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!ENTITY_TYPES.includes(body.entity_type)) return NextResponse.json({ error: 'invalid entity_type' }, { status: 400 })
  if (!body.entity_id) return NextResponse.json({ error: 'entity_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfi_links') as any)
    .insert({ rfi_id: id, entity_type: body.entity_type, entity_id: body.entity_id, created_by: user.id })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
