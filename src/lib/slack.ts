// Slack Web API wrapper using fetch. Used server-side only.
// Every function no-ops gracefully when SLACK_BOT_TOKEN isn't set.

import type { SupabaseClient } from '@supabase/supabase-js'

const SLACK_API = 'https://slack.com/api'

interface SlackBlock { type: string; [k: string]: unknown }

interface SlackResponse {
  ok: boolean
  error?: string
  channel?: { id: string } | string
  ts?: string
  user?: { id: string }
  [k: string]: unknown
}

function getToken(): string | null {
  return process.env.SLACK_BOT_TOKEN || null
}

async function slackPost(method: string, body: Record<string, unknown>): Promise<SlackResponse> {
  const token = getToken()
  if (!token) return { ok: false, error: 'SLACK_BOT_TOKEN not configured' }

  const res = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })
  return await res.json() as SlackResponse
}

async function slackGet(method: string, params: Record<string, string>): Promise<SlackResponse> {
  const token = getToken()
  if (!token) return { ok: false, error: 'SLACK_BOT_TOKEN not configured' }

  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${SLACK_API}/${method}?${qs}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  return await res.json() as SlackResponse
}

// ─── User resolution ──────────────────────────────────────────────
// Returns the Slack user ID for a Pathwaze user, caching it in public.users.slack_user_id
// once resolved. Looks up by email if not already cached.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveSlackUserId(supabase: SupabaseClient<any>, pathwazeUserId: string): Promise<string | null> {
  const { data: row } = await supabase
    .from('users')
    .select('slack_user_id, email')
    .eq('id', pathwazeUserId)
    .single() as { data: { slack_user_id: string | null; email: string } | null }

  if (!row) return null
  if (row.slack_user_id) return row.slack_user_id

  // Cache miss — look up by email
  const r = await slackGet('users.lookupByEmail', { email: row.email })
  if (!r.ok || !r.user) return null
  const slackId = r.user.id

  // Cache it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('users') as any).update({ slack_user_id: slackId }).eq('id', pathwazeUserId)
  return slackId
}

// ─── Sending ──────────────────────────────────────────────────────
// Opens a DM with a Slack user, returns the conversation channel ID.
export async function openDM(slackUserId: string): Promise<string | null> {
  const r = await slackPost('conversations.open', { users: slackUserId })
  if (!r.ok || !r.channel) return null
  return typeof r.channel === 'string' ? r.channel : r.channel.id
}

interface SendResult { ok: boolean; channel?: string; ts?: string; error?: string }

export async function sendMessage(channel: string, text: string, blocks?: SlackBlock[]): Promise<SendResult> {
  const r = await slackPost('chat.postMessage', {
    channel,
    text,         // fallback for notifications, accessibility, push previews
    ...(blocks ? { blocks } : {}),
    unfurl_links: false,
    unfurl_media: false,
  })
  return { ok: !!r.ok, channel: r.channel as string | undefined, ts: r.ts, error: r.error }
}

// Send a DM to a Pathwaze user. Resolves their Slack ID, opens DM, posts message.
// Returns { channel, ts } so caller can store and update/thread later.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendDM(supabase: SupabaseClient<any>, pathwazeUserId: string, text: string, blocks?: SlackBlock[]): Promise<SendResult> {
  const slackId = await resolveSlackUserId(supabase, pathwazeUserId)
  if (!slackId) return { ok: false, error: 'Could not resolve Slack user' }
  const dm = await openDM(slackId)
  if (!dm) return { ok: false, error: 'Could not open DM' }
  return await sendMessage(dm, text, blocks)
}

// Post to a known channel (no resolution needed)
export async function postToChannel(channelId: string, text: string, blocks?: SlackBlock[]): Promise<SendResult> {
  return await sendMessage(channelId, text, blocks)
}

// Reply in an existing thread (channel can be a DM channel ID or a regular channel)
export async function replyInThread(channel: string, threadTs: string, text: string, blocks?: SlackBlock[]): Promise<SendResult> {
  const r = await slackPost('chat.postMessage', {
    channel,
    thread_ts: threadTs,
    text,
    ...(blocks ? { blocks } : {}),
    unfurl_links: false,
    unfurl_media: false,
  })
  return { ok: !!r.ok, channel: r.channel as string | undefined, ts: r.ts, error: r.error }
}

// ─── Block builders ───────────────────────────────────────────────
export function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

export function taskAssignedBlocks(args: {
  title: string
  projectName: string
  dueDate?: string | null
  priority?: string | null
  type?: string | null
  description?: string | null
  assignedBy?: string | null
  taskPath: string  // e.g. /tasks?id=xxx
}): { text: string; blocks: SlackBlock[] } {
  const fallback = `New task: ${args.title}`
  const fieldsRow: { type: string; text: string }[] = []
  if (args.projectName) fieldsRow.push({ type: 'mrkdwn', text: `*Project*\n${args.projectName}` })
  if (args.dueDate)     fieldsRow.push({ type: 'mrkdwn', text: `*Due*\n${args.dueDate}` })
  if (args.priority)    fieldsRow.push({ type: 'mrkdwn', text: `*Priority*\n${args.priority}` })
  if (args.type)        fieldsRow.push({ type: 'mrkdwn', text: `*Type*\n${args.type}` })

  return {
    text: fallback,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '✅ New task assigned to you' } },
      { type: 'section', text: { type: 'mrkdwn', text: `*${args.title}*${args.assignedBy ? `\n_from ${args.assignedBy}_` : ''}` } },
      ...(fieldsRow.length ? [{ type: 'section', fields: fieldsRow }] : []),
      ...(args.description ? [{ type: 'section', text: { type: 'mrkdwn', text: args.description.slice(0, 280) } }] : []),
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Open in Pathwaze' }, url: appUrl(args.taskPath), style: 'primary' },
        ],
      },
    ],
  }
}

export function taskStatusChangedBlocks(args: {
  title: string
  projectName: string
  from: string
  to: string
  changedBy: string
  taskPath: string
}): { text: string; blocks: SlackBlock[] } {
  return {
    text: `Task "${args.title}" status changed: ${args.from} → ${args.to}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `🔄 *${args.title}*\n_${args.projectName}_` } },
      { type: 'section', text: { type: 'mrkdwn', text: `${args.changedBy} moved this task from *${args.from}* → *${args.to}*` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open' }, url: appUrl(args.taskPath) }] },
    ],
  }
}

export function projectStageChangedBlocks(args: {
  projectName: string
  from: string
  to: string
  changedBy: string
  projectPath: string
}): { text: string; blocks: SlackBlock[] } {
  return {
    text: `${args.projectName} stage: ${args.from} → ${args.to}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `🏷️ *${args.projectName}* moved to *${args.to}*\n_was ${args.from} · changed by ${args.changedBy}_` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open project' }, url: appUrl(args.projectPath), style: 'primary' }] },
    ],
  }
}

export function permitApprovedBlocks(args: {
  projectName: string
  permitName: string
  authority: string | null
  permitNumber: string | null
  approvedBy: string
  projectPath: string
}): { text: string; blocks: SlackBlock[] } {
  return {
    text: `Permit approved: ${args.permitName} for ${args.projectName}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `✅ *Permit approved* · _${args.projectName}_\n*${args.permitName}*${args.permitNumber ? ` · #${args.permitNumber}` : ''}${args.authority ? `\nfrom ${args.authority}` : ''}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Marked approved by ${args.approvedBy}` }] },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open project' }, url: appUrl(args.projectPath) }] },
    ],
  }
}

// ─── Profile sync ─────────────────────────────────────────────────
// Pulls a user's profile from Slack (image, timezone, title, display name)
// and writes it to public.users. Idempotent — safe to call on every sign-in.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncSlackProfile(supabase: SupabaseClient<any>, pathwazeUserId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: row } = await supabase
    .from('users')
    .select('slack_user_id, email')
    .eq('id', pathwazeUserId)
    .single() as { data: { slack_user_id: string | null; email: string } | null }

  if (!row) return { ok: false, error: 'user not found' }

  // Resolve Slack user ID if missing
  let slackId = row.slack_user_id
  if (!slackId) {
    const lookup = await slackGet('users.lookupByEmail', { email: row.email })
    if (!lookup.ok || !lookup.user) return { ok: false, error: lookup.error || 'lookup failed' }
    slackId = lookup.user.id
  }

  // Fetch full user profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const info = await slackGet('users.info', { user: slackId, include_locale: 'true' }) as any
  if (!info.ok || !info.user) return { ok: false, error: info.error || 'users.info failed' }

  const u = info.user
  const profile = u.profile || {}
  const update = {
    slack_user_id: slackId,
    avatar_url: profile.image_512 || profile.image_192 || profile.image_72 || profile.image_original || null,
    timezone: u.tz || null,
    timezone_label: u.tz_label || null,
    title: profile.title || null,
    slack_display_name: profile.display_name || profile.real_name || null,
    profile_synced_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('users') as any).update(update).eq('id', pathwazeUserId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// List the bot's joined channels — used for the project edit "Linked channel" picker
export async function listBotChannels(): Promise<{ channels: Array<{ id: string; name: string }>; error?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await slackGet('users.conversations', { types: 'public_channel,private_channel', limit: '200' }) as any
  if (!r.ok) return { channels: [], error: r.error || 'unknown' }
  return { channels: ((r.channels as Array<{ id: string; name: string }>) || []).map(c => ({ id: c.id, name: c.name })) }
}
