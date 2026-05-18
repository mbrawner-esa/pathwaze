import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncSlackProfile } from '@/lib/slack'

// OAuth callback for Slack (and any future OIDC providers).
// Exchanges the `code` for a session, then routes the user based on status:
//   pending  → /auth/pending
//   disabled → /auth/login?error=...
//   active   → /dashboard

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error_description') || searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Missing authorization code')}`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
  }

  // Fetch the user's profile row to read status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Login failed')}`)
  }

  // Best-effort: pull avatar / timezone / title from Slack on every login
  try {
    const r = await syncSlackProfile(supabase, user.id)
    console.log('[slack] profile sync result:', r)
  } catch (e) {
    console.warn('[slack] profile sync exception:', e)
  }

  const { data: profile } = await supabase
    .from('users')
    .select('status')
    .eq('id', user.id)
    .single()

  const status = (profile as { status?: string } | null)?.status ?? 'pending'
  if (status === 'disabled') {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent('Your account has been disabled. Contact an admin.')}`)
  }
  if (status === 'pending') {
    return NextResponse.redirect(`${origin}/auth/pending`)
  }
  return NextResponse.redirect(`${origin}/dashboard`)
}
