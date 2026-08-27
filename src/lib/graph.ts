// Microsoft Graph client for the Outlook → Threads email integration.
// Delegated OAuth (per-user "Connect Outlook"), read-only (Mail.Read).
// Server-side only. Every function throws if the MS_* env vars are missing.

const GRAPH = 'https://graph.microsoft.com/v1.0'

// Delegated scopes. offline_access is what grants us a refresh token.
export const SCOPES = [
  'offline_access',
  'openid',
  'email',
  'profile',
  'User.Read',
  'https://graph.microsoft.com/Mail.Read',
].join(' ')

function tenant(): string {
  const t = process.env.MS_TENANT_ID
  if (!t) throw new Error('MS_TENANT_ID is not set')
  return t
}
function clientId(): string {
  const c = process.env.MS_CLIENT_ID
  if (!c) throw new Error('MS_CLIENT_ID is not set')
  return c
}
function clientSecret(): string {
  const s = process.env.MS_CLIENT_SECRET
  if (!s) throw new Error('MS_CLIENT_SECRET is not set')
  return s
}

export function graphAppUrl(path: string): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // Normalize to the ORIGIN only. NEXT_PUBLIC_APP_URL is meant to be the site
  // origin (e.g. https://pathwaze.esa-solar.com). If someone pastes the full
  // callback URL or leaves a trailing slash, appending `path` would otherwise
  // yield a doubled path like `…/api/auth/outlook/callback/api/auth/outlook/callback`
  // and break OAuth with AADSTS50011 (redirect_uri mismatch). `new URL().origin`
  // strips any stray path/slash/query so the value is resilient to that typo.
  let base: string
  try {
    base = new URL(raw).origin
  } catch {
    base = raw.replace(/\/+$/, '')   // not a parseable URL — at least drop trailing slashes
  }
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

// Must match a Redirect URI registered on the Azure app exactly.
export function redirectUri(): string {
  return graphAppUrl('/api/auth/outlook/callback')
}

function authBase(): string {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0`
}

// Step 1 of OAuth: where we send the user to sign in + consent.
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  })
  return `${authBase()}/authorize?${params.toString()}`
}

export interface TokenSet {
  access_token: string
  refresh_token?: string
  expires_in: number      // seconds
  scope?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(`${authBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok) {
    throw new Error(`Graph token error: ${json.error || res.status} — ${json.error_description || ''}`.trim())
  }
  return json as TokenSet
}

// Step 2 of OAuth: exchange the authorization code for tokens.
export function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  return tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    scope: SCOPES,
  })
}

// Ongoing: trade a stored refresh token for a fresh access token
// (and usually a rotated refresh token).
export function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  return tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPES,
  })
}

// Which mailbox did the user connect?
export async function getMe(accessToken: string): Promise<{ mail: string | null; userPrincipalName: string | null; displayName: string | null }> {
  const res = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Graph /me failed: ${res.status}`)
  const j = await res.json()
  return { mail: j.mail ?? null, userPrincipalName: j.userPrincipalName ?? null, displayName: j.displayName ?? null }
}

export interface GraphAddress { name?: string; address?: string }
export interface GraphMessage {
  id: string
  conversationId?: string
  subject?: string
  bodyPreview?: string
  receivedDateTime?: string
  sentDateTime?: string
  from?: { emailAddress?: GraphAddress }
  toRecipients?: { emailAddress?: GraphAddress }[]
  ccRecipients?: { emailAddress?: GraphAddress }[]
  body?: { contentType?: string; content?: string }
}

// Metadata only — deliberately NO body. We page through the whole mailbox to
// find stakeholder matches, and most messages won't match, so pulling bodies
// here would be wasted transfer. Bodies are fetched per-match via fetchMessageBody.
// Metadata only — deliberately NO body. We page the mailbox to find stakeholder
// matches, and most messages won't match, so pulling bodies here would be wasted
// transfer. Bodies are fetched per-match via fetchMessageBody.
const MSG_SELECT = 'id,conversationId,subject,bodyPreview,receivedDateTime,sentDateTime,from,toRecipients,ccRecipients'
const PAGE_SIZE = 100
const DEFAULT_MAX_PAGES = 50   // per-run chunk (~5k messages) so a run fits a function timeout

// Mailbox-wide read across ALL folders (Inbox, Sent Items, filed subfolders):
// /me/messages returns the whole mailbox, unlike a per-folder delta. Ordered
// OLDEST-first from `sinceIso` so the caller can walk forward in bounded chunks
// (persisting the newest receivedDateTime seen as the next run's floor). Returns
// truncated=true when the chunk cap was hit and there's more to page.
export async function fetchMailboxMessages(
  accessToken: string,
  sinceIso: string,
  maxPages: number = DEFAULT_MAX_PAGES,
): Promise<{ messages: GraphMessage[]; truncated: boolean }> {
  const filter = encodeURIComponent(`receivedDateTime ge ${sinceIso}`)
  let url: string = `${GRAPH}/me/messages?$select=${MSG_SELECT}&$top=${PAGE_SIZE}&$orderby=receivedDateTime%20asc&$filter=${filter}`
  const messages: GraphMessage[] = []
  let truncated = false
  const headers = { Authorization: `Bearer ${accessToken}` }

  for (let page = 0; page < maxPages; page++) {
    const res: Response = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) throw new Error(`Graph messages failed: ${res.status} ${await res.text().catch(() => '')}`)
    const j = await res.json()
    if (Array.isArray(j.value)) messages.push(...(j.value as GraphMessage[]))
    if (j['@odata.nextLink']) {
      url = j['@odata.nextLink']
      if (page === maxPages - 1) truncated = true   // more pages remain past our cap
      continue
    }
    break   // reached the end of the window
  }

  return { messages, truncated }
}

// Full plain-text body for a single matched message. Requested with the text
// Prefer header so we store readable text rather than raw HTML.
export async function fetchMessageBody(
  accessToken: string,
  id: string,
): Promise<{ contentType?: string; content?: string } | null> {
  const res = await fetch(`${GRAPH}/me/messages/${encodeURIComponent(id)}?$select=body`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const j = await res.json()
  return j.body ?? null
}
