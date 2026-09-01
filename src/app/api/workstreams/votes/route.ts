import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Milestone upvotes (migration 071) — the priority signal on the /health board.
 *
 * POST   { milestone_id }  → add my vote
 * DELETE ?milestone_id=…   → remove my vote
 *
 * Deliberately NOT manager-gated, unlike the reorder endpoint it replaces.
 * Priority is worth more when the people doing the work can say what matters;
 * a tally that only managers can contribute to is just the drag order with
 * extra steps. RLS pins every row to the caller's own user_id, so nobody can
 * vote on someone else's behalf whatever they send.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { milestone_id } = await request.json() as { milestone_id?: string }
  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 })
  }

  // Upsert rather than insert: double-clicking the button is a normal thing to
  // do and should be idempotent, not a duplicate-key error in the user's face.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_votes') as any)
    .upsert({ milestone_id, user_id: user.id }, { onConflict: 'milestone_id,user_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const milestone_id = new URL(request.url).searchParams.get('milestone_id')
  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 })
  }

  // The user_id filter is belt-and-braces — RLS already scopes the delete to the
  // caller — but it makes the intent explicit at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_votes') as any)
    .delete().eq('milestone_id', milestone_id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
