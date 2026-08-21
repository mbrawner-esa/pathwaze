/**
 * MessageText — render a thread message string with proper handling of
 * Slack-style mentions, links, and mrkdwn so messages synced from Slack read
 * like real messages instead of raw markup.
 *
 * Tokens:
 *   <@USERID> / <@USERID|name>  → @mention (resolved to a display name)
 *   <!channel> / <!here>        → @channel / @here
 *   <#CHANNELID|name>           → #name
 *   <https://url|label>         → clickable label
 *   <https://url> / plain urls  → auto-link
 *
 * Slack mrkdwn (inline):
 *   *bold*   _italic_   ~strike~   `code`   (and nestings like _*bold italic*_)
 *
 * Layout:
 *   With `block`, the message is split into paragraphs and bulleted lists
 *   (Slack sends "•" bullets inline, often without newlines). Without `block`
 *   it renders inline in a <span> (for compact/clamped contexts).
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
  block?: boolean
}

export function MessageText({ text, users = [], className, block = false }: Props) {
  if (block) return <div className={className}>{renderBlocks(text ?? '', users)}</div>
  return <span className={className}>{parseInline(text ?? '', users, 'm')}</span>
}

function lookupUser(token: string, users: MentionUser[]): MentionUser | undefined {
  return users.find(u => u.slack_user_id === token) || users.find(u => u.id === token)
}

function firstName(name: string | null | undefined): string {
  if (!name) return 'user'
  return name.trim().split(/\s+/)[0]
}

// ── Block layout ────────────────────────────────────────────────────
// Slack often sends bulleted recaps as one line with inline "•". Break those
// onto their own lines, then group runs of bullets into <ul>.
function renderBlocks(text: string, users: MentionUser[]): React.ReactNode {
  const normalized = text.replace(/\s*•\s*/g, '\n• ').replace(/\n{3,}/g, '\n\n')
  const lines = normalized.split('\n')

  type Block = { type: 'p'; text: string } | { type: 'ul'; items: string[] }
  const blocks: Block[] = []
  let bullets: string[] | null = null
  const flush = () => { if (bullets) { blocks.push({ type: 'ul', items: bullets }); bullets = null } }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('• ')) { (bullets ??= []).push(line.slice(2)) }
    else { flush(); blocks.push({ type: 'p', text: line }) }
  }
  flush()

  return (
    <div className="space-y-1.5">
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="list-disc pl-5 space-y-1 marker:text-[#94a3b8]">
            {b.items.map((it, j) => <li key={j} className="leading-relaxed">{parseInline(it, users, `b${i}-${j}`)}</li>)}
          </ul>
        ) : (
          <p key={i} className="leading-relaxed">{parseInline(b.text, users, `p${i}`)}</p>
        )
      )}
    </div>
  )
}

// ── Inline parsing: tokens → urls → mrkdwn ──────────────────────────
function parseInline(text: string, users: MentionUser[], kb: string): React.ReactNode[] {
  if (!text) return []
  const tokenRe = /<(@|!|#|https?:\/\/)([^>|]*)\|?([^>]*)>/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) nodes.push(...linkifyAndFormat(text.slice(last, m.index), `${kb}-t${k}`))
    nodes.push(renderToken(m[1], m[2], m[3], users, `${kb}-tok${k}`))
    last = m.index + m[0].length
    k++
  }
  if (last < text.length) nodes.push(...linkifyAndFormat(text.slice(last), `${kb}-t${k}`))
  return nodes
}

function renderToken(kind: string, id: string, label: string, users: MentionUser[], key: string): React.ReactNode {
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
  const url = kind + id
  return (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-[#2C5485] hover:underline">
      {label || url}
    </a>
  )
}

function linkifyAndFormat(text: string, kb: string): React.ReactNode[] {
  const urlRe = /\bhttps?:\/\/[^\s<>]+/g
  const out: React.ReactNode[] = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(text)) !== null) {
    if (m.index > last) out.push(...applyMrkdwn(text.slice(last, m.index), `${kb}-f${k}`))
    out.push(
      <a key={`${kb}-u${k}`} href={m[0]} target="_blank" rel="noopener noreferrer" className="text-[#2C5485] hover:underline">{m[0]}</a>
    )
    last = m.index + m[0].length
    k++
  }
  if (last < text.length) out.push(...applyMrkdwn(text.slice(last), `${kb}-f${k}`))
  return out
}

// Slack inline mrkdwn: `code`, *bold*, _italic_, ~strike~ (recursive for nesting).
function applyMrkdwn(text: string, kb: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(`[^`\n]+`)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~[^~\n]+~)/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const inner = tok.slice(1, -1)
    const key = `${kb}-md${k++}`
    if (tok[0] === '`') out.push(<code key={key} className="px-1 py-0.5 rounded bg-[#F1F5F9] text-[12px] font-mono text-[#334155]">{inner}</code>)
    else if (tok[0] === '*') out.push(<strong key={key} className="font-semibold">{applyMrkdwn(inner, key)}</strong>)
    else if (tok[0] === '_') out.push(<em key={key}>{applyMrkdwn(inner, key)}</em>)
    else out.push(<del key={key} className="text-[#94a3b8]">{applyMrkdwn(inner, key)}</del>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
