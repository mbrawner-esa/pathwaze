/**
 * Entity decoding + tag stripping for user-authored rich text.
 *
 * `RichTextEditor` saves `contentEditable.innerHTML`. A note or description
 * typed as a single unformatted line carries **no tags at all** — but the
 * browser still escapes it on the way out, so runs of spaces become `&nbsp;`
 * and `&` becomes `&amp;`. Anything that treats a tagless value as plain text
 * therefore prints those entities literally
 * ("Dave has created&nbsp; a new helioscope…").
 *
 * So: before rendering editor content as *text* — rather than as HTML, where
 * the browser decodes for us — run it through here.
 *
 * Decoding is always safe for a text destination: `&lt;script&gt;` becomes the
 * literal characters `<script>`, which React renders as text and Slack sends
 * as text. Never feed the output of these functions to
 * `dangerouslySetInnerHTML`.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: '\u00a0',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** Decode the entities contentEditable emits. Unknown entities are left alone. */
export function decodeHtmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

/**
 * Flatten editor HTML to readable plain text — block tags become newlines,
 * list items get a bullet, everything else is dropped, entities are decoded.
 * For destinations that render text and not markup (Slack, previews).
 */
export function richTextToPlainText(raw: string): string {
  if (!raw) return ''
  const text = raw
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
  return decodeHtmlEntities(text)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
