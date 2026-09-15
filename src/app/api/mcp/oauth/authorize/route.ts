/**
 * /api/mcp/oauth/authorize — the consent step.
 *
 * GET  renders a consent screen for the signed-in Pathwaze user (bouncing to
 *      the normal login first if there is no session).
 * POST records their approval and redirects back to the client with a
 *      one-time code bound to the PKCE challenge and their user id.
 *
 * Investors are refused here: RLS would already limit them to their granted
 * projects, but an external party should not be pointing an agent at the
 * portfolio at all.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'
import { randomToken, CONNECTABLE_ROLES, MCP_SCOPE, appUrl } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

const CODE_TTL_MS = 5 * 60 * 1000
const CSRF_COOKIE = 'mcp_oauth_csrf'

type AuthParams = {
  client_id: string
  redirect_uri: string
  state: string
  code_challenge: string
  code_challenge_method: string
  scope: string
  resource: string
}

function readParams(sp: URLSearchParams): AuthParams {
  return {
    client_id: sp.get('client_id') || '',
    redirect_uri: sp.get('redirect_uri') || '',
    state: sp.get('state') || '',
    code_challenge: sp.get('code_challenge') || '',
    code_challenge_method: sp.get('code_challenge_method') || 'S256',
    scope: sp.get('scope') || MCP_SCOPE,
    resource: sp.get('resource') || '',
  }
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function page(title: string, bodyHtml: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Pathwaze</title>
<style>
  :root { color-scheme: light }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0F1B26; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:16px }
  .card { background:#F4F7FA; border-radius:12px; padding:32px; max-width:420px; width:100%;
          box-shadow:0 20px 50px rgba(0,0,0,.35) }
  h1 { font-size:18px; margin:0 0 6px; color:#2F3E50 }
  p { color:#6E879E; margin:0 0 16px; font-size:13px }
  .who { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:16px }
  .who strong { color:#2F3E50; display:block; font-size:13px }
  .who span { color:#6E879E; font-size:12px }
  ul { margin:0 0 20px; padding-left:18px; color:#2F3E50; font-size:13px }
  li { margin-bottom:5px }
  button { width:100%; padding:12px; border:0; border-radius:8px; font-weight:600; font-size:14px;
           cursor:pointer; background:#E6C87A; color:#5a4413 }
  button:hover { background:#d9b962 }
  .sec { background:transparent; color:#6E879E; margin-top:8px; font-weight:500 }
  .err { background:#fef2f2; border:1px solid #fecaca; color:#991b1b; border-radius:8px; padding:12px; font-size:13px }
  a { color:#C8963A }
</style></head><body><div class="card">${bodyHtml}</div></body></html>`
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Look the client up and confirm the redirect_uri was registered to it. */
async function validateClient(clientId: string, redirectUri: string) {
  if (!clientId || !redirectUri) return null
  const { data } = await serviceClient()
    .from('mcp_clients')
    .select('client_id,client_name,redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (!data) return null
  if (!(data.redirect_uris as string[]).includes(redirectUri)) return null
  return data
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const p = readParams(searchParams)

  if (searchParams.get('response_type') !== 'code') {
    return page('Unsupported request', `<h1>Unsupported request</h1><div class="err">Only response_type=code is supported.</div>`, 400)
  }
  if (!p.code_challenge || p.code_challenge_method !== 'S256') {
    return page('PKCE required', `<h1>PKCE required</h1><div class="err">This server requires code_challenge_method=S256.</div>`, 400)
  }

  const client = await validateClient(p.client_id, p.redirect_uri)
  if (!client) {
    // Never redirect back on an unvalidated redirect_uri — that is the one
    // error that has to be shown here rather than handed to the caller.
    return page('Unknown client', `<h1>Unknown client</h1><div class="err">This client id or redirect URI is not registered.</div>`, 400)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const next = `/api/mcp/oauth/authorize?${searchParams.toString()}`
    return NextResponse.redirect(appUrl(`/auth/login?next=${encodeURIComponent(next)}`))
  }

  const { data: profile } = await serviceClient()
    .from('users')
    .select('full_name,email,role,status')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.status && profile.status !== 'active')) {
    return page('Account not active', `<h1>Account not active</h1><div class="err">Your Pathwaze account is not active yet.</div>`, 403)
  }

  if (!CONNECTABLE_ROLES.includes(profile.role)) {
    return page(
      'Not available for your role',
      `<h1>Not available for your role</h1>
       <div class="err">The Pathwaze connector is limited to internal staff accounts. Your account has the <strong>${esc(profile.role)}</strong> role.</div>`,
      403
    )
  }

  const csrf = crypto.randomBytes(16).toString('hex')
  const hidden = Object.entries(p)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`)
    .join('')

  const res = page(
    'Connect to Pathwaze',
    `<h1>Connect ${esc(client.client_name || 'this app')} to Pathwaze</h1>
     <p>It will be able to read Pathwaze data as you.</p>
     <div class="who">
       <strong>${esc(profile.full_name || profile.email || '')}</strong>
       <span>${esc(profile.email || '')} · ${esc(profile.role)}</span>
     </div>
     <ul>
       <li>Read projects, notes, threads, tasks and milestones</li>
       <li>Read stakeholders, RFIs, permits and site data</li>
       <li>Sees exactly what you see in Pathwaze — nothing more</li>
       <li><strong>Cannot change or delete anything</strong></li>
     </ul>
     <form method="POST">
       ${hidden}
       <input type="hidden" name="csrf" value="${csrf}">
       <button type="submit">Allow access</button>
       <button type="submit" name="deny" value="1" class="sec">Cancel</button>
     </form>`
  )
  res.cookies.set(CSRF_COOKIE, csrf, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}

/**
 * 303, not the framework default of 307.
 *
 * This handler is reached by a POST from the consent form, and 307 PRESERVES
 * the method — so the browser would re-send the client's callback as a POST.
 * OAuth callbacks are GET endpoints (claude.ai answers a POST with "Method Not
 * Allowed"), and 303 is the status that means "follow this with GET".
 */
const seeOther = (url: string) => NextResponse.redirect(url, 303)

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const fields = new URLSearchParams()
  form.forEach((v, k) => fields.set(k, String(v)))
  const p = readParams(fields)

  const csrf = String(form.get('csrf') || '')
  if (!csrf || csrf !== req.cookies.get(CSRF_COOKIE)?.value) {
    return page('Request expired', `<h1>Request expired</h1><div class="err">Please start the connection again.</div>`, 400)
  }

  const client = await validateClient(p.client_id, p.redirect_uri)
  if (!client) {
    return page('Unknown client', `<h1>Unknown client</h1><div class="err">This client is not registered.</div>`, 400)
  }

  const back = new URL(p.redirect_uri)
  if (p.state) back.searchParams.set('state', p.state)

  if (form.get('deny')) {
    back.searchParams.set('error', 'access_denied')
    return seeOther(back.toString())
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    back.searchParams.set('error', 'access_denied')
    return seeOther(back.toString())
  }

  // Re-check the role on approval, not just on render.
  const { data: profile } = await serviceClient()
    .from('users')
    .select('role,status')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.status && profile.status !== 'active') || !CONNECTABLE_ROLES.includes(profile.role)) {
    back.searchParams.set('error', 'access_denied')
    back.searchParams.set('error_description', 'This Pathwaze role cannot connect.')
    return seeOther(back.toString())
  }

  const code = randomToken(24)
  const { error } = await serviceClient().from('mcp_auth_codes').insert({
    code,
    client_id: p.client_id,
    user_id: user.id,
    redirect_uri: p.redirect_uri,
    code_challenge: p.code_challenge,
    code_challenge_method: p.code_challenge_method,
    scope: p.scope,
    resource: p.resource || null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  })

  if (error) {
    console.error('[mcp authorize] could not store code:', error.message)
    back.searchParams.set('error', 'server_error')
    return seeOther(back.toString())
  }

  back.searchParams.set('code', code)
  const res = seeOther(back.toString())
  res.cookies.delete(CSRF_COOKIE)
  return res
}
