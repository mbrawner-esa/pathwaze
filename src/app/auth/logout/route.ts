import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /auth/logout — signs the user out server-side (a route handler can write
// cookies; a server component can't) and redirects to login. Used by the
// disabled-user gate in AppLayout, and safe to link to for a plain sign-out.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const dest = new URL('/auth/login', req.url)
  const error = new URL(req.url).searchParams.get('error')
  if (error) dest.searchParams.set('error', error)
  return NextResponse.redirect(dest)
}
