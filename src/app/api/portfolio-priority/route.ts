import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isManagerOrAbove } from '@/lib/permissions'

/**
 * The manual priority order behind /health (migration 069).
 *
 * PATCH  — takes project ids in their new order and rewrites the whole set.
 * DELETE — clears the order, returning the board to its automatic urgency sort.
 *
 * Writes are manager+, matching who can open the dashboard at all. The board is
 * a shared artifact — one person dragging changes what the whole team sees in
 * the meeting — so this is deliberately not something every viewer can move.
 */

/** Guard shared by both verbs. Returns a response to send, or the user id. */
async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { deny: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data: me } = await supabase
    .from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
  if (!isManagerOrAbove(me?.role)) {
    return { deny: NextResponse.json({ error: 'Manager access required' }, { status: 403 }) }
  }
  return { userId: user.id }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireManager(supabase)
  if (gate.deny) return gate.deny

  const { ids } = await request.json() as { ids?: string[] }
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  // Reject duplicates rather than letting the last one win: a repeated id means
  // the client's list was wrong, and silently ranking it twice would produce an
  // order nobody dragged.
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'ids must be unique' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const rows = ids.map((project_id, i) => ({
    project_id,
    rank: i + 1,
    set_at: now,
    set_by: gate.userId,
  }))

  // Rewrite the whole set in one upsert. Rank is positional, so a partial write
  // would leave two projects claiming the same slot — worse than not saving.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('portfolio_priority') as any)
    .upsert(rows, { onConflict: 'project_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Anything ranked before but absent from this list is stale — a project that
  // was archived or put on hold since the last drag. Clearing it keeps the
  // stored order matching what the board actually shows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('portfolio_priority') as any)
    .delete()
    .not('project_id', 'in', `(${ids.join(',')})`)

  return NextResponse.json({ ok: true, count: ids.length, set_at: now })
}

export async function DELETE() {
  const supabase = await createClient()
  const gate = await requireManager(supabase)
  if (gate.deny) return gate.deny

  // No .eq() filter — clearing the board is the whole point of this verb.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('portfolio_priority') as any)
    .delete()
    .gte('rank', 0)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
