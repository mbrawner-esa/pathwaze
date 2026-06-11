import { createClient } from '@/lib/supabase/server'
import { ensureReview } from '@/lib/drawings'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/drawings/[id]/review
// Returns the drawing, its review, the in-scope sections (Universal + the
// drawing's discipline) with items, the per-drawing findings, and the shared
// set-level Universal answers. The client merges these for display.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawing } = await (supabase.from('drawings') as any)
    .select('*, area:buildings(id, name, category), collection:drawing_collections(id, name, action_plan_id)')
    .eq('id', id).maybeSingle()
  if (!drawing) return NextResponse.json({ error: 'Drawing not found' }, { status: 404 })

  // Ensure a review exists (created on first open if the drawing is linked).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: review } = await (supabase.from('drawing_reviews') as any)
    .select('*').eq('drawing_id', id).maybeSingle()
  if (!review) review = await ensureReview(supabase, drawing)
  if (!review) return NextResponse.json({ error: 'No action plan for this drawing' }, { status: 400 })

  const planId = review.action_plan_id

  // Scope = Universal section + the drawing's discipline section.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections } = await (supabase.from('action_plan_sections') as any)
    .select('id, key, label, is_universal, sort_order, items:action_plan_items(id, prompt, hunting_for, reviewer_hint, sort_order)')
    .eq('action_plan_id', planId)
    .or(`is_universal.eq.true,key.eq.${drawing.discipline_key ?? '___none___'}`)
    .order('sort_order')

  // Sort items within each section.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (sections ?? []) as any[]) {
    s.items = (s.items ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findings } = await (supabase.from('review_findings') as any)
    .select('*, task:tasks!delegated_task_id(id, status, title), rfi:rfis!rfi_id(id, rfi_number, status)')
    .eq('drawing_review_id', review.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let universal: any[] = []
  if (drawing.area_id && drawing.collection_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: uni } = await (supabase.from('set_universal_findings') as any)
      .select('*').eq('area_id', drawing.area_id).eq('collection_id', drawing.collection_id)
    universal = uni ?? []
  }

  return NextResponse.json({ drawing, review, sections: sections ?? [], findings: findings ?? [], universal })
}

// PATCH /api/drawings/[id]/review  → update review status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const patch: Record<string, unknown> = {}
  if (body.status) {
    patch.status = body.status
    patch.completed_at = body.status === 'complete' ? new Date().toISOString() : null
  }
  if (body.reviewer_id !== undefined) patch.reviewer_id = body.reviewer_id
  if (body.qc_id !== undefined) patch.qc_id = body.qc_id
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawing_reviews') as any)
    .update(patch).eq('drawing_id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
