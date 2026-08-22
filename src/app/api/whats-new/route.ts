import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { RELEASE } from '@/lib/whats-new'

// POST /api/whats-new  { key } → mark this release as seen for the current user,
// so the login modal stops firing. Only the current release key is accepted, so
// a stale tab can't stamp a future release as already-read.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (body.key !== RELEASE.key) {
    return NextResponse.json({ error: 'Unknown release key' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any)
    .update({ whats_new_seen: RELEASE.key })
    .eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
