import { NextRequest, NextResponse } from 'next/server'

// Shared auth gate for the cron endpoints.
//
// ⚠️ These routes are side-effectful and internet-reachable: they send Slack
// DMs and emails to the whole team and mirror mailbox content into project
// Threads. They are not behind the app's session auth, so this check is the
// only thing standing in front of them.
//
// It replaces an `if (secret) { …check… }` pattern that was duplicated in all
// three routes and failed **open**: with `CRON_SECRET` unset the check was
// skipped entirely, so "nobody configured a secret" was indistinguishable from
// "this caller is authorized". That is how an unauthenticated GET was able to
// fire a real reminder run against production.
//
// Now it fails closed. An unset secret is a misconfiguration, not a free pass.
//
// Note on `?key=`: kept because the documented manual-run workflow uses it, but
// a secret in a query string lands in access logs. Prefer the Bearer header
// (`-H "Authorization: Bearer $CRON_SECRET"`) for anything ad-hoc.

/**
 * Returns a response to send back when the request is NOT authorized, or `null`
 * when the caller may proceed.
 *
 *   const denied = requireCronAuth(req)
 *   if (denied) return denied
 */
export function requireCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET

  // 503, not 401: nothing the caller can do about it, and it should read as
  // "this deployment is misconfigured" in logs rather than "wrong password".
  if (!secret) {
    console.error('[cron] refused: CRON_SECRET is not set. Set it in the Vercel project env and redeploy.')
    return NextResponse.json(
      { error: 'Cron endpoint is not configured (CRON_SECRET missing). Refusing to run.' },
      { status: 503 },
    )
  }

  const auth = req.headers.get('authorization') || ''
  const key = req.nextUrl.searchParams.get('key') || ''
  if (auth !== `Bearer ${secret}` && key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
