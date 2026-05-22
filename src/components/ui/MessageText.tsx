/**
 * MessageText — render a thread message string with proper handling of
 * Slack-style mentions and links so messages synced from Slack don't show
 * raw markup like "<@U7RHKP63V>".
 *
 * Supported tokens:
 *   <@USERID>              → @FirstName (or @display name) if we can resolve
 *                            the Slack user id; otherwise @user
 *   <@USERID|name>         → @name (Slack sometimes pre-renders this)
 *   <!channel> / <!here>   → @channel / @here
 *   <#CHANNELID|name>      → #name
 *   <https://url|label>    → clickable label
 *   <https://url>          → clickable url
 *   plain URLs             → auto-link
 *
 * Pathwaze-native mentions can use <@uuid> where the uuid matches a row's
 * users.id — same parser, falls back to that lookup when the slack lookup
 * misses.
 */
import React from 'react'

export interface MentionUser {
  id: string
  full_name?: string | null
  slack_user_id?: string | null
}

interface Props {
  text: string
  users?: MentionUser[]
  className?: string
}

export function MessageText({ text, users = [], className }: Props) {
  const parts = parseMessage(text, users)
  return <span className={className}>{parts}</span>
}

function lookupUser(token: string, users: MentionUser[]): MentionUser | undefined {
  // Try slack id first (most common, since most syncs come from Slack)
  return users.find(u => u.slack_user_id === token) || users.find(u => u.id === token)
}

function firstName(name: string | null | undefined): string {
  if (!name) return 'user'
  return name.trim().split(/\s+/)[0]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessage(text: string, users: MentionUser[]): React.ReactNode[] {
  if (!text) return [text ?? '']

  // Single combined regex for all Slack-style tokens we recognize.
  // Order matters: more specific patterns first.
  //   <@USERID|name>  → mention with display
  //   <@USERID>       → mention
  //   <!here>         → broadcast
  //   <!channel>      → broadcast
  //   <#CHID|name>    → channel ref
  //   <url|label>     → link with label
  //   <url>           → bare link
  const tokenRe = /<(@|!|#|https?:\/\/)([^>|]*)\|?([^>]*)>/g
  // Also detect bare urls (no <>) so plain pasted links work.
  const urlRe = /\bhttps?:\/\/[^\s<>]+/g

  // Two-pass: first extract <...> tokens, then auto-link any leftover bare urls.
  const nodes: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...linkifyText(text.slice(last, m.index), urlRe))
    const kind = m[1]
    const id = m[2]
    const label = m[3]
    nodes.push(renderToken(kind, id, label, users, nodes.length))
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(...linkifyText(text.slice(last), urlRe))
  return nodes
}

function renderToken(kind: string, id: string, label: string, users: MentionUser[], idx: number): React.ReactNode {
  const key = `tok-${idx}`
  if (kind === '@') {
    const u = lookupUser(id, users)
    const display = label || (u ? firstName(u.full_name) : 'user')
    return (
      <span key={key} className="inline-flex items-center px-1 py-0 rounded bg-[#EFF6FF] text-[#1d4ed8] font-medium" title={u?.full_name ?? id}>
        @{display}
      </span>
    )
  }
  if (kind === '!') {
    // Broadcast: <!channel>, <!here>, <!everyone>, <!subteam^...|@team>
    const display = label || id
    return (
      <span key={key} className="inline-flex items-center px-1 py-0 rounded bg-[#FEF3C7] text-[#92400E] font-medium">
        @{display}
      </span>
    )
  }
  if (kind === '#') {
    const display = label || id
    return (
      <span key={key} className="inline-flex items-center px-1 py-0 rounded bg-[#F1F5F9] text-[#475569] font-medium">
        #{display}
      </span>
    )
  }
  // Anything else is a url (kind starts with http)
  const url = kind + id + (label ? '' : '')
  const href = `${kind}${id}`
  return (
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-[#2C5485] hover:underline">
      {label || url}
    </a>
  )
}

function linkifyText(text: string, urlRe: RegExp): React.ReactNode[] {
  urlRe.lastIndex = 0
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <a key={`url-${m.index}`} href={m[0]} target="_blank" rel="noopener noreferrer" className="text-[#2C5485] hover:underline">{m[0]}</a>
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
