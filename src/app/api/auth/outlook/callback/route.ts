import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { exchangeCodeForTokens, getMe, graphAppUrl, SCOPES } from '@/lib/graph'
import { encryptSecret } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/auth/outlook/callback
// Completes OAuth: verifies CSRF state, exchanges the code for tokens, stores
// the (encrypted) refresh token against the signed-in user, and returns to
// Settings. Tokens are written with the service-role client so they never pass
// through the user's RLS-scoped session.
export async function GET(req: NextRequest) {
  const backTo = (status: string) => NextResponse.redirect(graphAppUrl(`/settings?outlook=${status}`))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('outlook_oauth_state')?.value
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    console.warn('[outlook callback] provider error:', oauthError, url.searchParams.get('error_description'))
    return backTo('error')
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return backTo('error')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(graphAppUrl('/auth/login'))

  try {
    const tokens = await exchangeCodeForTokens(code)
    if (!tokens.refresh_token) {
      // offline_access should guarantee this; guard anyway.
      console.error('[outlook callback] no refresh_token returned')
      return backTo('error')
    }
    const me = await getMe(tokens.access_token)
    const accountEmail = me.mail || me.userPrincipalName || null
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString()

    const svc = serviceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('email_connections') as any).upsert({
      user_id: user.id,
      provider: 'microsoft',
      account_email: accountEmail,
      refresh_token_enc: encryptSecret(tokens.refresh_token),
      access_token: tokens.access_token,
      expires_at: expiresAt,
      scopes: tokens.scope || SCOPES,
      delta_link: null,          // fresh connection → full resync on next cron
      connected_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'user_id' })

    if (error) {
      console.error('[outlook callback] upsert failed:', error.message)
      return backTo('error')
    }

    const res = backTo('connected')
    res.cookies.delete('outlook_oauth_state')
    return res
  } catch (e) {
    console.error('[outlook callback] failed:', e)
    return backTo('error')
  }
}
