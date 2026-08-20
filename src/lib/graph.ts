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
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
  from?: { emailAddress?: GraphAddress }
  toRecipients?: { emailAddress?: GraphAddress }[]
  ccRecipients?: { emailAddress?: GraphAddress }[]
  body?: { contentType?: string; content?: string }
  categories?: string[]
  ['@removed']?: unknown
}

const DELTA_SELECT = 'id,conversationId,subject,bodyPreview,receivedDateTime,from,toRecipients,ccRecipients,body,categories'

// Incremental inbox read. Pass the stored deltaLink to get only what changed
// since last run, or null for the first run. Follows nextLink pages and returns
// the fresh deltaLink to persist for next time.
export async function fetchInboxDelta(
  accessToken: string,
  deltaLink: string | null,
): Promise<{ messages: GraphMessage[]; deltaLink: string | null }> {
  let url = deltaLink
    || `${GRAPH}/me/mailFolders/inbox/messages/delta?$select=${DELTA_SELECT}`
  const messages: GraphMessage[] = []
  let nextDelta: string | null = null

  // Request plain-text bodies so the mirrored message is readable, not raw HTML.
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Prefer: 'outlook.body-content-type="text"',
  }

  // Guard against runaway paging.
  for (let page = 0; page < 50; page++) {
    const res: Response = await fetch(url, { headers, cache: 'no-store' })
    if (!res.ok) throw new Error(`Graph delta failed: ${res.status} ${await res.text().catch(() => '')}`)
    const j = await res.json()
    if (Array.isArray(j.value)) messages.push(...(j.value as GraphMessage[]))
    if (j['@odata.nextLink']) { url = j['@odata.nextLink']; continue }
    nextDelta = j['@odata.deltaLink'] ?? null
    break
  }

  return { messages, deltaLink: nextDelta }
}
