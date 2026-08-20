import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { authorizeUrl, graphAppUrl } from '@/lib/graph'

export const dynamic = 'force-dynamic'

// GET /api/auth/outlook/connect
// Starts the delegated OAuth flow: sets a CSRF state cookie and redirects the
// signed-in user to Microsoft to consent to Mail.Read on their own mailbox.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(graphAppUrl('/auth/login'))

  let url: string
  try {
    const state = crypto.randomBytes(16).toString('hex')
    url = authorizeUrl(state)
    const res = NextResponse.redirect(url)
    res.cookies.set('outlook_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
    return res
  } catch (e) {
    console.error('[outlook connect] failed:', e)
    return NextResponse.redirect(graphAppUrl('/settings?outlook=error'))
  }
}
