import { createClient } from '@/lib/supabase/server'
import { createRfiFromFinding } from '@/lib/rfis'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/drawings/[id]/review/rfi
// Create an RFI from a finding and attach it (review_findings.rfi_id).
// body: { item_id, subject, question, ball_in_court_user_id?, ball_in_court_stakeholder_id?,
//         due_date?, cost_impact?, schedule_impact?, drawing_number? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!body.item_id || !body.subject?.trim()) {
    return NextResponse.json({ error: 'item_id and subject required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawing } = await (supabase.from('drawings') as any)
    .select('id, project_id, area_id, file_name').eq('id', id).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (supabase.from('drawing_reviews') as any)
    .select('id').eq('drawing_id', id).maybeSingle()
  if (!drawing || !review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const rfi = await createRfiFromFinding(supabase, user.id, {
    project_id: drawing.project_id,
    area_id: drawing.area_id,
    drawing_id: drawing.id,
    subject: body.subject.trim(),
    question: body.question ?? null,
    ball_in_court_user_id: body.ball_in_court_user_id ?? null,
    ball_in_court_stakeholder_id: body.ball_in_court_stakeholder_id ?? null,
    due_date: body.due_date ?? null,
    cost_impact: body.cost_impact ?? 'tbd',
    schedule_impact: body.schedule_impact ?? 'tbd',
    drawing_number: body.drawing_number ?? null,
    status: body.status === 'draft' ? 'draft' : 'open',
  })
  if (!rfi) return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 })

  // Stamp the finding with the RFI id (ensure a row exists).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('review_findings') as any)
    .select('id').eq('drawing_review_id', review.id).eq('action_plan_item_id', body.item_id).maybeSingle()
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('review_findings') as any).update({ rfi_id: rfi.id }).eq('id', existing.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('review_findings') as any).insert({
      drawing_review_id: review.id, action_plan_item_id: body.item_id, rfi_id: rfi.id, created_by: user.id,
    })
  }
  // Link the finding back from the RFI.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('rfis') as any).update({ source_finding_id: existing?.id ?? null }).eq('id', rfi.id)

  return NextResponse.json({ rfi: { id: rfi.id, rfi_number: rfi.rfi_number, status: rfi.status } })
}
