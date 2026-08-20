import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { refreshAccessToken, fetchInboxDelta, type GraphMessage } from '@/lib/graph'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

// GET /api/cron/email-sync
// For every connected mailbox: pull the inbox delta, keep only messages whose
// sender/recipients match a known stakeholder, and mirror those into that
// stakeholder's project Threads (source='email'). Read-only — never modifies mail.
//
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token / ?key=).
// Supports ?dry=1 (report only) and ?user=<uuid> (sync a single user).

const BODY_MAX = 20000

interface Conn {
  id: string
  user_id: string
  account_email: string | null
  refresh_token_enc: string | null
  access_token: string | null
  expires_at: string | null
  delta_link: string | null
}

function addrsOf(m: GraphMessage): string[] {
  const out: string[] = []
  const push = (a?: { address?: string }) => { if (a?.address) out.push(a.address.toLowerCase()) }
  push(m.from?.emailAddress)
  for (const r of m.toRecipients ?? []) push(r.emailAddress)
  for (const r of m.ccRecipients ?? []) push(r.emailAddress)
  return out
}

function bodyTextOf(m: GraphMessage): string {
  const raw = m.body?.content?.trim() || m.bodyPreview?.trim() || ''
  // We request text bodies via Prefer header, but strip tags defensively.
  const text = m.body?.contentType === 'html' ? raw.replace(/<[^>]+>/g, ' ') : raw
  return text.slice(0, BODY_MAX)
}

// Fresh access token for a connection; refreshes + persists if expired/expiring.
// Returns null (and records last_error) if the refresh token is no longer valid.
async function validAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: any,
  conn: Conn,
): Promise<string | null> {
  const notExpired = conn.access_token && conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000
  if (notExpired) return conn.access_token

  if (!conn.refresh_token_enc) return null
  try {
    const refreshToken = decryptSecret(conn.refresh_token_enc)
    const tokens = await refreshAccessToken(refreshToken)
    const patch: Record<string, unknown> = {
      access_token: tokens.access_token,
      expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
    }
    // Microsoft rotates refresh tokens — persist the new one when returned.
    if (tokens.refresh_token) patch.refresh_token_enc = encryptSecret(tokens.refresh_token)
    await svc.from('email_connections').update(patch).eq('id', conn.id)
    return tokens.access_token
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await svc.from('email_connections').update({ last_error: `refresh failed: ${msg}`.slice(0, 500) }).eq('id', conn.id)
    return null
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    const key = req.nextUrl.searchParams.get('key') || ''
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const onlyUser = req.nextUrl.searchParams.get('user')
  const svc = serviceClient()

  // Build the routing maps once: stakeholder email → project, ESA user email → user.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stakeholders } = await (svc.from('stakeholders') as any)
    .select('id, email, project_id, name')
    .not('email', 'is', null).neq('email', '').not('project_id', 'is', null)
  const stakeholderByEmail = new Map<string, { project_id: string; name: string | null }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (stakeholders ?? []) as any[]) {
    const key = (s.email || '').trim().toLowerCase()
    if (key && !stakeholderByEmail.has(key)) stakeholderByEmail.set(key, { project_id: s.project_id, name: s.name })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usersRows } = await (svc.from('users') as any).select('id, email, full_name, avatar_url')
  const userByEmail = new Map<string, { id: string; full_name: string | null; avatar_url: string | null }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const u of (usersRows ?? []) as any[]) {
    const key = (u.email || '').trim().toLowerCase()
    if (key) userByEmail.set(key, { id: u.id, full_name: u.full_name, avatar_url: u.avatar_url })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (svc.from('email_connections') as any)
    .select('id, user_id, account_email, refresh_token_enc, access_token, expires_at, delta_link')
  if (onlyUser) q = q.eq('user_id', onlyUser)
  const { data: conns, error: connErr } = await q
  if (connErr) return NextResponse.json({ error: connErr.message }, { status: 500 })

  const report: Array<Record<string, unknown>> = []
  let totalMirrored = 0

  for (const conn of (conns ?? []) as Conn[]) {
    const token = dry && !conn.access_token ? null : await validAccessToken(svc, conn)
    if (!token) {
      report.push({ account: conn.account_email, skipped: 'no valid token' })
      continue
    }

    let messages: GraphMessage[] = []
    let nextDelta: string | null = conn.delta_link
    try {
      const r = await fetchInboxDelta(token, conn.delta_link)
      messages = r.messages
      nextDelta = r.deltaLink
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await svc.from('email_connections').update({ last_error: msg.slice(0, 500) }).eq('id', conn.id)
      report.push({ account: conn.account_email, error: msg })
      continue
    }

    let matched = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = []
    for (const m of messages) {
      if (m['@removed']) continue                 // deleted/moved — nothing to mirror
      const stakeholderHit = addrsOf(m).map(a => stakeholderByEmail.get(a)).find(Boolean)
      if (!stakeholderHit) continue               // not a stakeholder conversation → ignore
      matched++

      const fromAddr = m.from?.emailAddress?.address?.toLowerCase() || null
      const internal = fromAddr ? userByEmail.get(fromAddr) : undefined
      const toAddr = (m.toRecipients ?? []).map(r => r.emailAddress?.address).filter(Boolean).join(', ')
      rows.push({
        project_id: stakeholderHit.project_id,
        source: 'email',
        message_id: m.id,
        conversation_id: m.conversationId ?? null,
        subject: m.subject ?? null,
        from_addr: m.from?.emailAddress?.address ?? null,
        to_addr: toAddr || null,
        user_id: internal?.id ?? null,
        user_name: internal?.full_name ?? m.from?.emailAddress?.name ?? m.from?.emailAddress?.address ?? 'Email',
        user_avatar_url: internal?.avatar_url ?? null,
        message: bodyTextOf(m),
        created_at: m.receivedDateTime ?? new Date().toISOString(),
      })
    }

    if (!dry && rows.length) {
      // Dedup on (project_id, message_id) — safe to re-run.
      const { error: insErr } = await svc
        .from('project_threads')
        .upsert(rows, { onConflict: 'project_id,message_id', ignoreDuplicates: true })
      if (insErr) {
        await svc.from('email_connections').update({ last_error: `insert: ${insErr.message}`.slice(0, 500) }).eq('id', conn.id)
        report.push({ account: conn.account_email, error: insErr.message })
        continue
      }
    }

    if (!dry) {
      await svc.from('email_connections')
        .update({ delta_link: nextDelta, last_synced_at: new Date().toISOString(), last_error: null })
        .eq('id', conn.id)
    }

    totalMirrored += rows.length
    report.push({ account: conn.account_email, scanned: messages.length, matched, mirrored: dry ? 0 : rows.length })
  }

  return NextResponse.json({ ok: true, dry, connections: (conns ?? []).length, mirrored: totalMirrored, report })
}
