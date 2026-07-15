import { createClient } from '@/lib/supabase/server'
import { ensureReview } from '@/lib/drawings'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/drawings/[id]/review/comments → add a free-form comment { body }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  // Resolve the review for this drawing (creating it if needed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: review } = await (supabase.from('drawing_reviews') as any).select('id').eq('drawing_id', id).maybeSingle()
  if (!review) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: drawing } = await (supabase.from('drawings') as any).select('*').eq('id', id).maybeSingle()
    if (drawing) review = await ensureReview(supabase, drawing)
  }
  if (!review) return NextResponse.json({ error: 'No review for this drawing' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('review_comments') as any)
    .insert({ drawing_review_id: review.id, body: body.body.trim(), author_id: user.id })
    .select('*, author:users!author_id(id, full_name, avatar_url)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
