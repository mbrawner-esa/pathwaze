import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { refreshAccessToken, fetchMailboxMessages, fetchMessageBody, type GraphMessage } from '@/lib/graph'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // give the chunked sync room (Hobby caps here)

// GET /api/cron/email-sync
// For every connected mailbox: read messages across the WHOLE mailbox from the
// last 12 months (Inbox, Sent Items, filed folders), keep only those whose
// sender/recipients match a known stakeholder, and mirror them into that
// stakeholder's project Threads (source='email'). Read-only — never modifies mail.
//
// Incremental: each run only re-reads from the last successful sync's
// high-water mark (minus a small overlap), floored at 12 months ago. Dedup on
// (project_id, message_id) makes overlap and re-runs harmless.
//
// Protected by CRON_SECRET (Vercel Cron sends it as a Bearer token / ?key=).
// Supports ?dry=1 (report only) and ?user=<uuid> (sync a single user).

const BODY_MAX = 20000

// Floor date: 12 months before `ref`.
function twelveMonthsBefore(ref: Date): Date {
  const d = new Date(ref)
  d.setMonth(d.getMonth() - 12)
  return d
}

function bodyToText(body: { contentType?: string; content?: string } | null, fallbackPreview?: string): string {
  const raw = body?.content?.trim() || fallbackPreview?.trim() || ''
  const text = body?.contentType === 'html' ? raw.replace(/<[^>]+>/g, ' ') : raw
  return text.slice(0, BODY_MAX)
}

interface Conn {
  id: string
  user_id: string
  account_email: string | null
  refresh_token_enc: string | null
  access_token: string | null
  expires_at: string | null
  last_synced_at: string | null
}

function addrsOf(m: GraphMessage): string[] {
  const out: string[] = []
  const push = (a?: { address?: string }) => { if (a?.address) out.push(a.address.toLowerCase()) }
  push(m.from?.emailAddress)
  for (const r of m.toRecipients ?? []) push(r.emailAddress)
  for (const r of m.ccRecipients ?? []) push(r.emailAddress)
  return out
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
    .select('id, user_id, account_email, refresh_token_enc, access_token, expires_at, last_synced_at')
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

    // Forward-walk floor: resume from the last high-water mark, but never older
    // than 12 months. On first connect (no high-water) this starts 12 months back.
    const runStart = new Date()
    const floorTwelveMo = twelveMonthsBefore(runStart)
    const floor = conn.last_synced_at
      ? new Date(Math.max(new Date(conn.last_synced_at).getTime(), floorTwelveMo.getTime()))
      : floorTwelveMo
    const sinceIso = floor.toISOString()

    let messages: GraphMessage[] = []
    let truncated = false
    try {
      const r = await fetchMailboxMessages(token, sinceIso)
      messages = r.messages
      truncated = r.truncated
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
      const stakeholderHit = addrsOf(m).map(a => stakeholderByEmail.get(a)).find(Boolean)
      if (!stakeholderHit) continue               // not a stakeholder conversation → ignore
      matched++

      const fromAddr = m.from?.emailAddress?.address?.toLowerCase() || null
      const internal = fromAddr ? userByEmail.get(fromAddr) : undefined
      const toAddr = (m.toRecipients ?? []).map(r => r.emailAddress?.address).filter(Boolean).join(', ')
      // Fetch the full body only for matched messages (small set) — and only when
      // actually writing. Dry runs use the lightweight preview.
      const body = dry ? null : await fetchMessageBody(token, m.id)
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
        message: bodyToText(body, m.bodyPreview),
        created_at: m.receivedDateTime ?? m.sentDateTime ?? new Date().toISOString(),
      })
    }

    // High-water mark for the next run: newest receivedDateTime we just scanned
    // (messages come back oldest-first). When nothing was in the window, advance
    // to now so the floor keeps pace.
    const newest = messages.length
      ? messages[messages.length - 1].receivedDateTime ?? messages[messages.length - 1].sentDateTime ?? null
      : null
    const nextHighWater = newest ?? runStart.toISOString()

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
      // Advance the high-water mark. If truncated, more of the window remains —
      // the next run resumes from here and keeps backfilling forward.
      await svc.from('email_connections')
        .update({ last_synced_at: nextHighWater, last_error: truncated ? 'backfilling: more history to page' : null })
        .eq('id', conn.id)
    }

    totalMirrored += rows.length
    report.push({ account: conn.account_email, since: sinceIso, scanned: messages.length, matched, mirrored: dry ? 0 : rows.length, truncated })
  }

  return NextResponse.json({ ok: true, dry, connections: (conns ?? []).length, mirrored: totalMirrored, report })
}
