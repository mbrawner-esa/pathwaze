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
  const slackUserName = form.get('user_name') || ''
  const slackChannelId = form.get('channel_id') || ''
  const slackChannelName = form.get('channel_name') || ''
  const teamDomain = form.get('team_domain') || ''

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
      return NextResponse.json({ response_type: 'ephemeral', text: 'Usage: `/pathwaze project <name or number> [your message]`' })
    }

    const supabase = service()

    // Smart parse: try progressively longer prefixes of the arg as the project,
    // treat any unmatched trailing text as the user's comment about that project.
    const tokens = arg.split(/\s+/)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let project: ProjectCardArgs | null = null
    let comment = ''

    // The portfolio is small (~19 projects), so fetch all in ONE query and match
    // in memory. The old code fired up to 8 sequential queries (2 per prefix
    // length × 4), which pushed the handler past Slack's 3s slash-command
    // timeout on cold starts (the reported "operation_timeout"). One round-trip
    // fixes that while preserving the exact match semantics below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, name, project_number, stage, city, state, system_kwdc') as any
    const projects = (allProjects ?? []) as ProjectCardArgs[]

    for (let i = Math.min(tokens.length, 4); i > 0 && !project; i--) {
      const cand = tokens.slice(0, i).join(' ').toLowerCase()
      // 1) exact project_number, then 2) partial name match — longest prefix first.
      const match =
        projects.find(p => (p.project_number ?? '').toLowerCase() === cand) ||
        projects.find(p => (p.name ?? '').toLowerCase().includes(cand))
      if (match) {
        project = match
        comment = tokens.slice(i).join(' ').trim()
      }
    }

    if (!project) {
      return NextResponse.json({ response_type: 'ephemeral', text: `No project found matching *${arg}*. Try the project name or number.` })
    }

    // Record the mention in two places so it shows up in:
    //   - Activity feed (activity_log row)
    //   - Threads tab (project_threads row — visible Slack-style message)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matchedUser } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('slack_user_id', slackUserId)
        .single() as any

      // Build a human-readable mention message
      const channelDisplay = slackChannelName ? `#${slackChannelName}` : `another channel`
      const channelDeepLink = teamDomain ? `https://${teamDomain}.slack.com/archives/${slackChannelId}` : ''
      const userDisplay = matchedUser?.full_name || slackUserName || 'Someone'
      // If the user typed an additional comment, that becomes the primary message;
      // otherwise we just record the mention itself.
      const mentionMsg = comment
        ? `${comment}\n\n_— mentioned in ${channelDisplay}${channelDeepLink ? ` (${channelDeepLink})` : ''}_`
        : `${userDisplay} referenced this project in ${channelDisplay}${channelDeepLink ? ` — ${channelDeepLink}` : ''}`

      // Synthetic Slack ts (we don't get one for slash commands). Random suffix for uniqueness.
      const syntheticTs = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('project_threads') as any).insert({
        project_id: project.id,
        slack_channel_id: slackChannelId,
        slack_ts: syntheticTs,
        slack_user_id: slackUserId,
        user_id: matchedUser?.id ?? null,
        user_name: userDisplay,
        user_avatar_url: matchedUser?.avatar_url ?? null,
        message: mentionMsg,
        raw_payload: { via: 'slash_command', channel_name: slackChannelName, team_domain: teamDomain, text },
      })

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
            from_channel_name: slackChannelName,
            channel_deep_link: channelDeepLink,
            comment: comment || null,
            slack_user_id: slackUserId,
            via: 'slash_command',
          },
        })
      }
    } catch (err) {
      console.warn('[slack commands] mention record failed:', err)
    }

    return NextResponse.json(projectCard(project))
  }

  return NextResponse.json({ response_type: 'ephemeral', text: `Unknown subcommand \`${sub}\`. Try \`/pathwaze help\`.` })
}
