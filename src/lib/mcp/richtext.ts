/**
 * Turn model-written markdown into the exact HTML subset RichTextEditor
 * produces, so a note created over MCP is indistinguishable from one typed in
 * Pathwaze — same bullets, same numbered lists, same blue mention chips, and
 * the same notification behaviour via parseMentions().
 *
 * SAFETY — note the approach. NotesRender renders bodies with
 * dangerouslySetInnerHTML on the stated assumption that the HTML came from our
 * own editor. MCP content does not: it is model-authored and may carry text
 * lifted from a document in the session. Rather than hand-roll a whitelist
 * sanitiser (which is where XSS bugs live), this module **escapes every
 * character of caller input and builds the HTML itself**. Nothing the caller
 * writes is ever interpreted as markup, so `<script>` in a source document
 * arrives as the literal text `<script>`. The only tags in the output are the
 * ones constructed here.
 *
 * Callers send markdown. HTML input is rejected with a message telling them to
 * send markdown — see toPathwazeHtml.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

/** Tags the editor can produce — used only to detect HTML input and refuse it. */
const HTML_INPUT_RE = /<\/?(p|div|span|ul|ol|li|br|b|strong|i|em|a|h[1-6]|script|img|table)\b/i

const MENTION_SENTINEL = '\u0001'

export interface RichTextResult {
  /** Storage-ready HTML, in the editor's own dialect. */
  html: string
  /** User ids that will be notified by parseMentions(). */
  mentionedUserIds: string[]
  /** Display names of everyone who will be notified. */
  mentionedNames: string[]
  /** @tokens that matched nobody and were left as plain text. */
  unresolved: string[]
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Only http(s) links survive; anything else (javascript:, data:) becomes text. */
const safeHref = (url: string): string | null => {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

type MentionHit = { id: string; name: string }

/**
 * Replace `@Name` with sentinel placeholders, resolved against the user list.
 *
 * Runs before escaping so that a name containing `&` still matches. Matches the
 * longest candidate at each `@`, so "@Morgan Brawner" wins over "@Morgan".
 * Candidates are full name, first name, and email local part.
 *
 * A token matching nobody is left alone as plain text; a token matching more
 * than one person throws, rather than guessing which colleague to email.
 */
function extractMentions(
  text: string,
  users: Row[]
): { text: string; hits: MentionHit[]; unresolved: string[] } {
  const candidates: { key: string; user: Row }[] = []
  // Disabled accounts are never mentionable — the mention would email a dead
  // address, and a disabled duplicate of a live person's name would make that
  // name permanently ambiguous.
  for (const u of users.filter((x) => !x.status || x.status === 'active')) {
    const full = (u.full_name || '').trim()
    if (full) {
      candidates.push({ key: full.toLowerCase(), user: u })
      const first = full.split(/\s+/)[0]
      if (first && first.toLowerCase() !== full.toLowerCase()) {
        candidates.push({ key: first.toLowerCase(), user: u })
      }
    }
    const local = (u.email || '').split('@')[0]
    if (local) candidates.push({ key: local.toLowerCase(), user: u })
  }
  // Longest first so "morgan brawner" is tried before "morgan".
  candidates.sort((a, b) => b.key.length - a.key.length)

  const hits: MentionHit[] = []
  const unresolved: string[] = []
  let out = ''
  let i = 0

  while (i < text.length) {
    const at = text.indexOf('@', i)
    if (at === -1) {
      out += text.slice(i)
      break
    }
    out += text.slice(i, at)

    // An @ inside a word (an email address, say) is not a mention.
    const prev = at > 0 ? text[at - 1] : ' '
    if (/[\w.]/.test(prev)) {
      out += '@'
      i = at + 1
      continue
    }

    const rest = text.slice(at + 1)
    const restLower = rest.toLowerCase()
    const matched = candidates.filter((c) => restLower.startsWith(c.key))

    if (matched.length === 0) {
      const token = (rest.match(/^[\w.-]+/) || [''])[0]
      if (token) unresolved.push(`@${token}`)
      out += '@'
      i = at + 1
      continue
    }

    const longest = matched[0].key
    const tied = matched.filter((c) => c.key === longest)
    const distinctUsers = new Set(tied.map((c) => c.user.id))
    if (distinctUsers.size > 1) {
      const names = tied.map((c) => `${c.user.full_name || 'unnamed'} <${c.user.email}>`).join(', ')
      throw new Error(
        `"@${rest.slice(0, longest.length)}" matches more than one person: ${names}. ` +
          'Use a full name so the right person is notified.'
      )
    }

    const user = tied[0].user
    hits.push({ id: user.id, name: user.full_name || user.email || 'user' })
    out += `${MENTION_SENTINEL}${hits.length - 1}${MENTION_SENTINEL}`
    i = at + 1 + longest.length
  }

  return { text: out, hits, unresolved }
}

/** Inline markdown on already-escaped text. Order matters: links, then bold, then italic. */
function inline(escaped: string): string {
  let s = escaped

  // [label](url) — the url arrives escaped, so unescape just enough to parse it.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, label: string, rawUrl: string) => {
    const url = rawUrl.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    const href = safeHref(url)
    return href ? `<a href="${escapeHtml(href)}">${label}</a>` : whole
  })

  // Bare URLs the author didn't wrap.
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, pre: string, rawUrl: string) => {
    const url = rawUrl.replace(/&amp;/g, '&')
    const href = safeHref(url)
    return href ? `${pre}<a href="${escapeHtml(href)}">${escapeHtml(url)}</a>` : `${pre}${rawUrl}`
  })

  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  s = s.replace(/__([^_]+)__/g, '<b>$1</b>')
  // Single * / _ for italic, avoiding the ** already consumed above.
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>')
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<i>$2</i>')

  return s
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] }

/**
 * Markdown block structure → the editor's HTML.
 *
 * Headings become bold paragraphs: the Pathwaze editor has no heading button,
 * so a <h2> would be content no person could have produced here.
 */
function blocks(text: string): string {
  const out: Block[] = []
  let list: Block | null = null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      out.push({ kind: 'p', lines: para })
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      out.push(list)
      list = null
    }
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const h = line.match(/^\s*#{1,6}\s+(.*)$/)

    if (ul) {
      flushPara()
      if (!list || list.kind !== 'ul') {
        flushList()
        list = { kind: 'ul', items: [] }
      }
      list.items.push(ul[1])
    } else if (ol) {
      flushPara()
      if (!list || list.kind !== 'ol') {
        flushList()
        list = { kind: 'ol', items: [] }
      }
      list.items.push(ol[1])
    } else if (h) {
      flushPara()
      flushList()
      out.push({ kind: 'p', lines: [`**${h[1]}**`] })
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()

  return out
    .map((b) => {
      if (b.kind === 'p') return `<p>${b.lines.map((l) => inline(l)).join('<br>')}</p>`
      const tag = b.kind
      return `<${tag}>${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`
    })
    .join('')
}

/**
 * Convert caller markdown into storage-ready Pathwaze HTML.
 *
 * `users` should be the list the mentions may refer to (userMap() values).
 * Throws on HTML input or an ambiguous @name — both are worth telling the
 * caller about rather than silently mangling.
 */
export function toPathwazeHtml(input: string, users: Row[] = []): RichTextResult {
  const raw = (input ?? '').trim()
  if (!raw) return { html: '', mentionedUserIds: [], mentionedNames: [], unresolved: [] }

  if (HTML_INPUT_RE.test(raw)) {
    throw new Error(
      'Send markdown, not HTML. Use "- " for bullets, "1. " for numbered lists, ' +
        '**bold**, [text](url) for links, and @Name to mention someone.'
    )
  }

  const { text, hits, unresolved } = extractMentions(raw, users)

  // Everything from here is escaped; the only markup is what blocks() builds.
  let html = blocks(escapeHtml(text))

  // Swap the sentinels for real mention spans, matching MentionInput.tsx:170
  // byte for byte so NotesRender styles them and parseMentions() finds them.
  html = html.replace(
    new RegExp(`${MENTION_SENTINEL}(\\d+)${MENTION_SENTINEL}`, 'g'),
    (_m, idx: string) => {
      const hit = hits[Number(idx)]
      if (!hit) return ''
      return `<span class="mention" contenteditable="false" data-uid="${hit.id}">@${escapeHtml(hit.name)}</span>`
    }
  )

  // Belt and braces: a sentinel that survived would be invisible junk.
  html = html.split(MENTION_SENTINEL).join('')

  const seen = new Set<string>()
  const mentionedUserIds: string[] = []
  const mentionedNames: string[] = []
  for (const h of hits) {
    if (seen.has(h.id)) continue
    seen.add(h.id)
    mentionedUserIds.push(h.id)
    mentionedNames.push(h.name)
  }

  return {
    html,
    mentionedUserIds,
    mentionedNames,
    unresolved: unresolved.filter((v, i) => unresolved.indexOf(v) === i),
  }
}

/** Plain-text preview of stored HTML, for tool responses and confirmations. */
export function htmlToText(html: string): string {
  return html
    .replace(/<li>/g, '\n• ')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Strip inline markdown markers, keeping the text a person would read. */
function stripInline(line: string): string {
  let s = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) =>
    label.trim() === url.trim() ? url : `${label} (${url})`
  )
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
  s = s.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1$2')
  return s
}

/**
 * Markdown → readable plain text, for the fields Pathwaze stores and renders as
 * plain text rather than rich HTML.
 *
 * `rfis.question` is the one that matters here. Its own form is a bare
 * `<textarea>` ([RfisClient.tsx:168](src/components/rfis/RfisClient.tsx:168))
 * and the detail page prints it with `whitespace-pre-wrap`
 * ([RfiDetailClient.tsx:151](src/components/rfis/RfiDetailClient.tsx:151)) —
 * so HTML written here renders as literal `<p>` tags on the page. Line breaks
 * and list markers survive; emphasis and link markup do not, because the field
 * has nowhere to put them.
 *
 * `@Name` is deliberately left as written: nothing parses mentions out of an
 * RFI question, so a span here would notify no one. The ball-in-court
 * assignment is what sends the email.
 */
export function toPlainText(input: string): string {
  const raw = (input ?? '').trim()
  if (!raw) return ''

  if (HTML_INPUT_RE.test(raw)) {
    throw new Error(
      'Send markdown or plain text, not HTML. This field is displayed as written, ' +
        'so tags would show up on the page.'
    )
  }

  const lines = raw.split('\n').map((rawLine) => {
    let line = rawLine.replace(/\s+$/, '')
    const h = line.match(/^\s*#{1,6}\s+(.*)$/)
    if (h) line = h[1]
    const ul = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (ul) line = `${ul[1]}• ${ul[2]}`
    return stripInline(line)
  })

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
