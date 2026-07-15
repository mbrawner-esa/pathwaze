'use client'
/**
 * MentionInput — a single-line composer with @-mention autocomplete that shows
 * friendly @Name chips while storing Slack-style plain-text `<@USER_UUID>` tokens.
 *
 * It's a contentEditable surface (so mentions render as @Name chips, never the
 * raw UID), but its serialized value is PLAIN TEXT: text nodes pass through and
 * each mention span collapses back to `<@uuid>`. MessageText renders that token
 * as @Name (resolving the uuid/slack id against the users list), so the stored
 * format stays plain text — no HTML, no renderer change.
 *
 * Used by the Slack-style composers (task comments, offtaker pricing threads).
 * Parse the sent message with parseTokenMentions() (src/lib/rfi-notify.ts) to
 * notify mentioned users.
 */
import { useEffect, useRef, useState } from 'react'
import type { MentionUser } from './MessageText'

export function MentionInput({
  value,
  onChange,
  onSubmit,
  users,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  /** Called on Enter (without Shift) when the mention menu is NOT open. */
  onSubmit?: () => void
  users: MentionUser[]
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ top: number; left: number; query: string; active: number } | null>(null)

  // Keep the editable DOM in sync with the controlled `value`, but only when it
  // actually diverges (e.g. a programmatic reset to '' after send) — otherwise
  // we'd clobber the caret on every keystroke.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (serialize(el) !== (value ?? '')) el.innerHTML = valueToHtml(value ?? '', users)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const matches = (() => {
    if (!menu) return [] as MentionUser[]
    const q = menu.query.toLowerCase()
    return users.filter(u => (u.full_name || '').toLowerCase().includes(q)).slice(0, 6)
  })()

  function emit() {
    if (ref.current) onChange(serialize(ref.current))
  }

  function detectMention() {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) { setMenu(null); return }
    const range = sel.getRangeAt(0)
    if (range.startContainer.nodeType !== Node.TEXT_NODE) { setMenu(null); return }
    const before = (range.startContainer.textContent ?? '').slice(0, range.startOffset)
    const m = before.match(/@(\w*)$/)
    if (!m) { setMenu(null); return }
    const rect = range.getBoundingClientRect()
    setMenu({ top: rect.bottom + 4, left: rect.left, query: m[1], active: 0 })
  }

  function insertMention(u: MentionUser) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !ref.current) return
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    const offset = range.startOffset
    const before = (node.textContent ?? '').slice(0, offset)
    const m = before.match(/@(\w*)$/)
    if (!m) return
    const del = document.createRange()
    del.setStart(node, offset - m[0].length)
    del.setEnd(node, offset)
    del.deleteContents()
    const span = document.createElement('span')
    span.className = 'mention'
    span.setAttribute('data-uid', u.id)
    span.setAttribute('contenteditable', 'false')
    span.textContent = '@' + (u.full_name || 'user')
    del.insertNode(span)
    const space = document.createTextNode(' ')
    span.after(space)
    const after = document.createRange()
    after.setStartAfter(space); after.collapse(true)
    sel.removeAllRanges(); sel.addRange(after)
    setMenu(null)
    emit()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (menu && matches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...menu, active: (menu.active + 1) % matches.length }); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...menu, active: (menu.active - 1 + matches.length) % matches.length }); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(matches[menu.active]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit?.() }
  }

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        data-placeholder={placeholder ?? ''}
        onInput={() => { emit(); detectMention() }}
        onKeyUp={detectMention}
        onClick={detectMention}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
        className={'w-full min-h-[38px] whitespace-pre-wrap break-words leading-normal [&_.mention]:text-[#2C5485] [&_.mention]:font-semibold [&_.mention]:bg-[#EFF4FA] [&_.mention]:rounded [&_.mention]:px-1 empty:before:content-[attr(data-placeholder)] empty:before:text-[#A8A8A8] ' + (className ?? '')}
      />
      {menu && matches.length > 0 && (
        <div className="fixed z-[100] bg-white border border-[#DDDBDA] rounded-lg shadow-xl py-1 w-56" style={{ top: menu.top, left: menu.left }}>
          {matches.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(u) }}
              className={'w-full text-left px-3 py-1.5 text-[13px] ' + (i === menu.active ? 'bg-[#EFF4FA] text-[#2C5485]' : 'text-[#181818] hover:bg-[#f8fafc]')}
            >
              @{u.full_name || 'user'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── plain-text serialization ──────────────────────────────────────────────
// Walk the editable DOM → plain string. Text passes through; each mention span
// collapses back to its <@uuid> token; <br> → newline.
function serialize(root: HTMLElement): string {
  let out = ''
  root.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? ''
    else if (n.nodeName === 'BR') out += '\n'
    else if (n instanceof HTMLElement) {
      const uid = n.getAttribute('data-uid')
      out += uid ? `<@${uid}>` : serialize(n)
    }
  })
  return out
}

// Render a stored plain-text value (with <@uuid> tokens) back into chip HTML,
// used only when the controlled value is set/reset externally.
function valueToHtml(value: string, users: MentionUser[]): string {
  if (!value) return ''
  const re = /<@([0-9a-fA-F-]{8,})>/g
  let html = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(value))) {
    html += escapeHtml(value.slice(last, m.index))
    const id = m[1]
    const u = users.find(x => x.id === id || x.slack_user_id === id)
    const name = u ? (u.full_name || 'user') : 'user'
    html += `<span class="mention" contenteditable="false" data-uid="${id}">@${escapeHtml(name)}</span>`
    last = m.index + m[0].length
  }
  html += escapeHtml(value.slice(last))
  return html
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
