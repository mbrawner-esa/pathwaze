import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * This week's focus (migration 072).
 *
 * POST   { milestone_id }  → mark as focus
 * DELETE ?milestone_id=…   → unmark
 *
 * Focus is a SHARED decision, so this is deliberately not scoped to the caller:
 * anyone signed in can set it and everyone sees the same list. The board itself
 * is manager-only, which is where the real gate sits; a team member reaching
 * this endpoint directly is adding to a list their own dashboard reads, which
 * is not a privilege worth a second door.
 */

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { milestone_id } = await request.json() as { milestone_id?: string }
  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id is required' }, { status: 400 })
  }

  // Upsert, not insert: ticking an already-focused row is a normal thing to do
  // and should be a no-op rather than a duplicate-key error.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_focus') as any)
    .upsert({ milestone_id, set_by: user.id, set_at: new Date().toISOString() },
            { onConflict: 'milestone_id' })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_focus') as any)
    .delete().eq('milestone_id', milestone_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
