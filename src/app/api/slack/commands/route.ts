import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient as createSbClient } from '@supabase/supabase-js'

// Slack slash command handler
// Configured in Slack App as: /pathwaze, Request URL = .../api/slack/commands
// Verifies signature using SLACK_SIGNING_SECRET.

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function verifySignature(rawBody: string, ts: string, signature: string): boolean {
  if (!SLACK_SIGNING_SECRET) return false
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(ts))
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false
  const base = `v0:${ts}:${rawBody}`
  const expected = 'v0=' + crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(base).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch { return false }
}

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSbClient(url, key, { auth: { persistSession: false } })
}

interface ProjectCardArgs {
  id: string
  name: string
  project_number?: string | null
  stage?: string | null
  city?: string | null
  state?: string | null
  system_kwdc?: number | null
}

function projectCard(p: ProjectCardArgs) {
  const url = `${APP_URL}/projects/${p.id}`
  const where = [p.city, p.state].filter(Boolean).join(', ')
  const size = p.system_kwdc ? `${p.system_kwdc.toLocaleString()} kWdc` : ''
  const lines: string[] = []
  if (p.project_number) lines.push(`*${p.name}* · _${p.project_number}_`)
  else lines.push(`*${p.name}*`)
  const tags: string[] = []
  if (p.stage) tags.push(p.stage)
  if (where) tags.push(where)
  if (size) tags.push(size)
  if (tags.length) lines.push(tags.join(' · '))

  return {
    response_type: 'in_channel',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      { type: 'actions', elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open in Pathwaze' }, url, style: 'primary' },
      ] },
    ],
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const ts = req.headers.get('x-slack-request-timestamp') || ''
  const sig = req.headers.get('x-slack-signature') || ''
  if (!verifySignature(rawBody, ts, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const form = new URLSearchParams(rawBody)
  const text = (form.get('text') || '').trim()
  const slackUserId = form.get('user_id') || ''
  const slackChannelId = form.get('channel_id') || ''

  // Parse subcommand. Currently only: `project <name|number>`
  const [sub, ...rest] = text.split(/\s+/)
  const arg = rest.join(' ').trim()

  if (!sub || sub === 'help') {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '*Pathwaze commands*\n• `/pathwaze project <name>` — post a project card and log a mention.',
    })
  }

  if (sub === 'project') {
    if (!arg) {
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/pathwaze project <name or number>`' })
    }

    const supabase = service()
    // Find a project by name (case-insensitive partial) or by project_number exact match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: byNumber } = await supabase
      .from('projects')
      .select('id, name, project_number, stage, city, state, system_kwdc')
      .eq('project_number', arg)
      .limit(1)
      .maybeSingle() as any

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let project: ProjectCardArgs | null = byNumber
    if (!project) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: byName } = await supabase
        .from('projects')
        .select('id, name, project_number, stage, city, state, system_kwdc')
        .ilike('name', `%${arg}%`)
        .limit(1)
        .maybeSingle() as any
      project = byName
    }

    if (!project) {
      return NextResponse.json({ response_type: 'ephemeral', text: `No project found matching *${arg}*.` })
    }

    // Log a "mentioned in slack" activity entry for the project
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matchedUser } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('slack_user_id', slackUserId)
        .single() as any

      if (matchedUser?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('activity_log') as any).insert({
          entity_type: 'project',
          entity_id: project.id,
          action: 'mentioned_in_slack',
          user_id: matchedUser.id,
          metadata: {
            project_id: project.id,
            from_channel: slackChannelId,
            slack_user_id: slackUserId,
            via: 'slash_command',
          },
        })
      }
    } catch (err) {
      console.warn('[slack commands] activity log failed:', err)
    }

    return NextResponse.json(projectCard(project))
  }

  return NextResponse.json({ response_type: 'ephemeral', text: `Unknown subcommand \`${sub}\`. Try \`/pathwaze help\`.` })
}
