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
  for (const k of ['area_id', 'discipline_key', 'set_label', 'drawing_type', 'file_name'] as const) {
    if (k in body) patch[k] = body[k]
  }

  // discipline_keys is a virtual field (synced into the drawing_disciplines join
  // table), not a column on drawings. When present, keep drawings.discipline_key
  // pointed at the primary (first) discipline for back-compat (DEPRECATED).
  const hasKeys = Array.isArray(body.discipline_keys)
  const keys: string[] = hasKeys ? (body.discipline_keys as string[]).filter(Boolean) : []
  if (hasKeys) patch.discipline_key = keys[0] ?? null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawings') as any)
    .update(patch).eq('id', id)
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-sync the many-to-many disciplines (delete-then-insert) when provided.
  if (hasKeys) {
    await supabase.from('drawing_disciplines').delete().eq('drawing_id', id)
    if (keys.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: joinErr } = await (supabase.from('drawing_disciplines') as any)
        .insert(keys.map(k => ({ drawing_id: id, discipline_key: k })))
      if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 })
    }
  }

  // Once a drawing has an area and at least one discipline, it's reviewable — create the review.
  if (data?.area_id && (data?.discipline_key || keys.length)) {
    await ensureReview(supabase, data)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fresh } = await (supabase.from('drawings') as any)
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status, reviewer_id, due_date), drawing_disciplines(discipline_key)')
    .eq('id', id).single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out = fresh ?? data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discipline_keys = Array.isArray((out as any)?.drawing_disciplines)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (out as any).drawing_disciplines.map((j: { discipline_key: string }) => j.discipline_key)
    : keys
  return NextResponse.json({ ...out, discipline_keys })
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
