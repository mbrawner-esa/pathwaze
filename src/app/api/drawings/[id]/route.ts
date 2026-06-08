import { createClient } from '@/lib/supabase/server'
import { ensureReview } from '@/lib/drawings'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/drawings/[id] → update fields; linking area + discipline creates the review.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const patch: Record<string, unknown> = {}
  for (const k of ['area_id', 'discipline_key', 'set_label', 'drawing_type'] as const) {
    if (k in body) patch[k] = body[k]
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawings') as any)
    .update(patch).eq('id', id)
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Once a drawing has both an area and a discipline, it's reviewable — create the review.
  if (data?.area_id && data?.discipline_key) {
    await ensureReview(supabase, data)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fresh } = await (supabase.from('drawings') as any)
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status, reviewer_id, due_date)')
    .eq('id', id).single()

  return NextResponse.json(fresh ?? data)
}

// DELETE /api/drawings/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // Best-effort: remove the storage blob too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase.from('drawings') as any).select('storage_path').eq('id', id).maybeSingle()
  if (row?.storage_path) {
    try { await supabase.storage.from('drawings').remove([row.storage_path]) } catch { /* ignore */ }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('drawings') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
