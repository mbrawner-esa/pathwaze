import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { exchangeCodeForTokens, getMe, graphAppUrl, SCOPES } from '@/lib/graph'
import { encryptSecret } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 30   // token exchange + getMe + the brief on-connect sync kick

// GET /api/auth/outlook/callback
// Completes OAuth: verifies CSRF state, exchanges the code for tokens, stores
// the (encrypted) refresh token against the signed-in user, and returns to
// Settings. Tokens are written with the service-role client so they never pass
// through the user's RLS-scoped session.
export async function GET(req: NextRequest) {
  // `reason` gives Settings a specific, human-readable failure cause instead of
  // one opaque "please try again" banner — the actual error is also logged.
  const backTo = (status: string, reason?: string) =>
    NextResponse.redirect(graphAppUrl(`/settings?outlook=${status}${reason ? `&reason=${reason}` : ''}`))

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('outlook_oauth_state')?.value
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    console.warn('[outlook callback] provider error:', oauthError, url.searchParams.get('error_description'))
    // e.g. access_denied (consent declined), invalid_client / redirect_uri
    // mismatch, or admin-consent required — all surface here from Microsoft.
    return backTo('error', 'provider')
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    // Missing code, or the CSRF state cookie expired (10 min) / didn't match.
    return backTo('error', 'state')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(graphAppUrl('/auth/login'))

  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (e) {
    // Token exchange rejected: wrong/expired MS_CLIENT_SECRET, client-id/tenant
    // mismatch, or the redirect URI not matching the Azure registration.
    console.error('[outlook callback] token exchange failed:', e)
    return backTo('error', 'token')
  }
  if (!tokens.refresh_token) {
    // offline_access should guarantee this; guard anyway.
    console.error('[outlook callback] no refresh_token returned')
    return backTo('error', 'norefresh')
  }

  let accountEmail: string | null = null
  try {
    const me = await getMe(tokens.access_token)
    accountEmail = me.mail || me.userPrincipalName || null
  } catch (e) {
    console.error('[outlook callback] getMe failed:', e)
    return backTo('error', 'graph')
  }

  let refreshTokenEnc: string
  try {
    refreshTokenEnc = encryptSecret(tokens.refresh_token)
  } catch (e) {
    // TOKEN_ENC_KEY missing or not exactly 32 bytes.
    console.error('[outlook callback] token encryption failed:', e)
    return backTo('error', 'encrypt')
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString()
  const svc = serviceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('email_connections') as any).upsert({
    user_id: user.id,
    provider: 'microsoft',
    account_email: accountEmail,
    refresh_token_enc: refreshTokenEnc,
    access_token: tokens.access_token,
    expires_at: expiresAt,
    scopes: tokens.scope || SCOPES,
    delta_link: null,          // fresh connection → full resync on next cron
    connected_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: 'user_id' })

  if (error) {
    // Most likely SUPABASE_SERVICE_ROLE_KEY missing (falls back to anon key,
    // which RLS blocks) or a schema mismatch.
    console.error('[outlook callback] upsert failed:', error.message)
    return backTo('error', 'db')
  }

  // Kick an immediate user-scoped sync so mail shows up now instead of only at
  // the daily 11:00 UTC cron. Best-effort: we wait briefly then redirect; the
  // sync runs as its own invocation and the daily cron guarantees completion,
  // so a timeout or failure here never blocks a successful connect.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 9000)
    try {
      await fetch(graphAppUrl(`/api/cron/email-sync?user=${user.id}`), {
        headers: { Authorization: `Bearer ${cronSecret}` },
        cache: 'no-store',
        signal: ctrl.signal,
      })
    } catch {
      /* best-effort — the daily cron will catch up */
    } finally {
      clearTimeout(t)
    }
  }

  const res = backTo('connected')
  res.cookies.delete('outlook_oauth_state')
  return res
}
