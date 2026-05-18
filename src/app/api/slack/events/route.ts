import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// Slack Events API webhook.
// - Verifies request signature using SLACK_SIGNING_SECRET
// - Handles the URL verification handshake (initial setup)
// - On `message.im` events with a thread_ts, looks up the matching task
//   by tasks.slack_dm_ts and inserts a row in task_threads.

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''

function verifySlackSignature(rawBody: string, ts: string, signature: string): boolean {
  if (!SLACK_SIGNING_SECRET) return false
  // Reject replays older than 5 minutes
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts))
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false

  const base = `v0:${ts}:${rawBody}`
  const expected = 'v0=' + crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(base).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// We use the service-role client here so we can write across users without RLS hassles.
// The signature verification IS our auth boundary.
import { createClient as createSbClient } from '@supabase/supabase-js'
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSbClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const ts = req.headers.get('x-slack-request-timestamp') || ''
  const sig = req.headers.get('x-slack-signature') || ''

  if (!verifySlackSignature(rawBody, ts, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = JSON.parse(rawBody) } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }

  // URL verification handshake (one-time, when configuring the webhook)
  if (body.type === 'url_verification' && body.challenge) {
    return NextResponse.json({ challenge: body.challenge })
  }

  // Event callback
  if (body.type === 'event_callback' && body.event) {
    const e = body.event
    // We only care about DM (channel type 'im') messages that are threaded replies
    // and not bot messages (avoid loops echoing our own outbound posts)
    if (
      e.type === 'message' &&
      e.channel_type === 'im' &&
      e.thread_ts &&
      e.thread_ts !== e.ts &&    // ignore the parent message itself
      !e.bot_id &&                // ignore Pathwaze's own outbound DMs
      e.subtype !== 'bot_message'
    ) {
      try {
        const supabase = serviceClient()

        // Find the task this DM thread is anchored to
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: task } = await supabase
          .from('tasks')
          .select('id')
          .eq('slack_dm_channel', e.channel)
          .eq('slack_dm_ts', e.thread_ts)
          .single() as any

        if (task) {
          // Resolve Pathwaze user_id by Slack user_id (best effort; fall back to NULL)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('slack_user_id', e.user)
            .single() as any

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('task_threads') as any).insert({
            task_id: task.id,
            user_id: user?.id ?? null,
            message: e.text || '',
          })
        }
      } catch (err) {
        console.warn('[slack events] thread sync failed:', err)
      }
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
