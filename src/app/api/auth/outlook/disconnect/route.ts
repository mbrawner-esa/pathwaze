import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

// POST /api/auth/outlook/disconnect
// Removes the signed-in user's stored mailbox connection (tokens + delta cursor).
// Already-mirrored email threads are left in place.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const svc = serviceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('email_connections') as any).delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
