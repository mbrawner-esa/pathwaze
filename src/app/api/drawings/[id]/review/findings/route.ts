import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/drawings/[id]/review/findings
// Upsert a single finding for an item.
//   - Universal item, not overridden  → shared set_universal_findings (syncs across the set)
//   - Universal item, overridden      → per-drawing review_findings (is_override = true)
//   - Discipline item                 → per-drawing review_findings
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const { item_id, is_universal, override, disposition, finding_text, sheet_ref, sow_action } = body
  if (!item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawing } = await (supabase.from('drawings') as any)
    .select('id, area_id, collection_id').eq('id', id).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (supabase.from('drawing_reviews') as any)
    .select('id, status').eq('drawing_id', id).maybeSingle()
  if (!drawing || !review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const values = {
    disposition: disposition ?? null,
    finding_text: finding_text ?? null,
    sheet_ref: sheet_ref ?? null,
    sow_action: sow_action ?? null,
  }

  if (is_universal && !override) {
    // Shared, set-level answer.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('set_universal_findings') as any)
      .upsert({
        area_id: drawing.area_id, collection_id: drawing.collection_id,
        action_plan_item_id: item_id, ...values, updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'area_id,collection_id,action_plan_item_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Reverting to shared: drop any per-drawing override for this item.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('review_findings') as any)
      .delete().eq('drawing_review_id', review.id).eq('action_plan_item_id', item_id).eq('is_override', true)
  } else {
    // Per-drawing finding (discipline, or universal override).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('review_findings') as any)
      .select('id').eq('drawing_review_id', review.id).eq('action_plan_item_id', item_id).maybeSingle()
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('review_findings') as any)
        .update({ ...values, is_override: !!override, updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('review_findings') as any)
        .insert({ drawing_review_id: review.id, action_plan_item_id: item_id, is_override: !!override, created_by: user.id, ...values })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // First disposition flips the review into progress.
  if (review.status === 'not_started' && disposition) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('drawing_reviews') as any).update({ status: 'in_progress' }).eq('id', review.id)
  }

  return NextResponse.json({ ok: true })
}
