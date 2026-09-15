/**
 * Auth for the Pathwaze MCP server.
 *
 * Two distinct tokens, deliberately:
 *
 *   1. The token we hand Claude — an opaque random string. Stored only as a
 *      SHA-256 hash, so a database leak does not yield working credentials, and
 *      revocation is immediate (delete the row). Opaque rather than a JWT
 *      because there is then no signature-verification code of ours to get
 *      wrong.
 *
 *   2. The Supabase JWT we mint per request — HS256, five-minute expiry,
 *      sub = the user's id. This is what reaches PostgREST, so RLS evaluates
 *      every query as that user. Never stored, never sent to the client.
 *
 * The service-role key is used ONLY to read our own mcp_* bookkeeping tables.
 * It never touches project data — see query.ts.
 */
import crypto from 'crypto'
import { serviceClient } from '@/lib/supabase/service'

export const MCP_SCOPE = 'pathwaze:read'
const TOKEN_TTL_DAYS = 30
const SUPABASE_JWT_TTL_SECONDS = 300

/** Roles allowed to connect at all. Investors are refused before a token is issued. */
export const CONNECTABLE_ROLES = ['admin', 'manager', 'team'] as const

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function hashToken(token: string): string {
  const pepper = process.env.MCP_TOKEN_PEPPER
  if (!pepper) throw new Error('MCP_TOKEN_PEPPER is not set')
  return crypto.createHash('sha256').update(`${token}${pepper}`).digest('hex')
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

/** PKCE S256: base64url(sha256(verifier)) must equal the stored challenge. */
export function verifyPkce(verifier: string, challenge: string, method = 'S256'): boolean {
  if (method === 'plain') {
    return crypto.timingSafeEqual(Buffer.from(verifier), Buffer.from(challenge))
  }
  const computed = b64url(crypto.createHash('sha256').update(verifier).digest())
  if (computed.length !== challenge.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge))
}

/**
 * Mint a short-lived Supabase access JWT for one user.
 *
 * The project uses legacy HS256 Supabase keys, so this signs with the shared
 * JWT secret. Sign-only, which is why no JWT library is needed.
 */
export function mintSupabaseJwt(userId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set')

  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + SUPABASE_JWT_TTL_SECONDS,
    })
  )
  const signature = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  )
  return `${header}.${payload}.${signature}`
}

export type McpSession = {
  userId: string
  role: string
  fullName: string | null
  email: string | null
  /** Short-lived Supabase JWT — pass to query.ts so RLS applies. */
  jwt: string
}

/**
 * Resolve an incoming `Authorization: Bearer <token>` to a session.
 * Returns null for anything missing, expired, revoked or belonging to a user
 * whose role may no longer connect (a demotion takes effect immediately).
 */
export async function sessionFromBearer(header: string | null): Promise<McpSession | null> {
  const match = header?.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const svc = serviceClient()
  const { data: row } = await svc
    .from('mcp_tokens')
    .select('id,user_id,expires_at,revoked_at')
    .eq('token_hash', hashToken(match[1]))
    .maybeSingle()

  if (!row || row.revoked_at) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null

  // Re-check the role on every call rather than trusting what it was at issue
  // time — a user demoted to investor, or deactivated, loses access at once.
  const { data: user } = await svc
    .from('users')
    .select('id,role,full_name,email,status')
    .eq('id', row.user_id)
    .maybeSingle()

  if (!user) return null
  if (user.status && user.status !== 'active') return null
  if (!CONNECTABLE_ROLES.includes(user.role as (typeof CONNECTABLE_ROLES)[number])) return null

  // Best-effort; a failed touch must not fail the request.
  void svc.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)

  return {
    userId: user.id,
    role: user.role,
    fullName: user.full_name,
    email: user.email,
    jwt: mintSupabaseJwt(user.id),
  }
}

/** Issue a token for a user and record it. Returns the plaintext once. */
export async function issueToken(opts: {
  userId: string
  clientId: string
  clientName?: string | null
  scope?: string | null
}): Promise<{ token: string; expiresIn: number }> {
  const token = randomToken()
  const expiresIn = TOKEN_TTL_DAYS * 24 * 60 * 60

  const { error } = await serviceClient()
    .from('mcp_tokens')
    .insert({
      token_hash: hashToken(token),
      user_id: opts.userId,
      client_id: opts.clientId,
      client_name: opts.clientName ?? null,
      scope: opts.scope ?? MCP_SCOPE,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })

  if (error) throw new Error(`Could not issue token: ${error.message}`)
  return { token, expiresIn }
}

/**
 * Absolute base URL of this deployment, used in the OAuth discovery documents.
 *
 * Takes the ORIGIN of NEXT_PUBLIC_APP_URL and discards any path. That var has
 * historically been set to a full callback URL rather than a bare origin, which
 * silently produced nonsense endpoints like
 * `https://host/api/auth/outlook/callback/api/mcp`. OAuth issuers and endpoints
 * must hang off the origin, so this normalises rather than trusting the value.
 */
export function appUrl(path = ''): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  let origin: string
  try {
    origin = new URL(raw).origin
  } catch {
    origin = raw.replace(/\/+$/, '')
  }
  return `${origin}${path}`
}
