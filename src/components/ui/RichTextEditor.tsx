'use client'
/**
 * Rich text editor with bold / bullet / numbered / link toolbar buttons.
 * Uses contentEditable + execCommand under the hood; the saved value is HTML.
 *
 * Optional @-mentions: pass `mentionUsers` to enable an autocomplete that inserts
 * a styled, non-editable mention span (<span class="mention" data-uid="…">@Name</span>).
 * Callers can parse data-uid out of the saved HTML to notify mentioned users.
 *
 * Pair with NotesRender (./NotesRender.tsx) to display saved content.
 */
import { useEffect, useRef, useState } from 'react'
import { List, ListOrdered, Bold, Link2 } from 'lucide-react'

interface MentionUser { id: string; full_name?: string | null }

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  mentionUsers,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  mentionUsers?: MentionUser[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ top: number; left: number; query: string; active: number } | null>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exec(cmd: 'insertUnorderedList' | 'insertOrderedList' | 'bold') {
    ref.current?.focus()
    document.execCommand(cmd, false)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function addLink() {
    ref.current?.focus()
    const url = window.prompt('Link URL')
    if (!url) return
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
    document.execCommand('createLink', false, href)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const matches = (() => {
    if (!menu || !mentionUsers) return [] as MentionUser[]
    const q = menu.query.toLowerCase()
    return mentionUsers.filter(u => (u.full_name || '').toLowerCase().includes(q)).slice(0, 6)
  })()

  function detectMention() {
    if (!mentionUsers) return
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
    const space = document.createTextNode(' ')
    span.after(space)
    const after = document.createRange()
    after.setStartAfter(space); after.collapse(true)
    sel.removeAllRanges(); sel.addRange(after)
    setMenu(null)
    onChange(ref.current.innerHTML)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!menu || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setMenu({ ...menu, active: (menu.active + 1) % matches.length }) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMenu({ ...menu, active: (menu.active - 1 + matches.length) % matches.length }) }
    else if (e.key === 'Enter') { e.preventDefault(); insertMention(matches[menu.active]) }
    else if (e.key === 'Escape') { setMenu(null) }
  }

  return (
    <div className="border border-[#cbd5e1] rounded focus-within:border-[#70A0D0] focus-within:ring-2 focus-within:ring-[#70A0D0]/20 bg-white relative">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#e2e8f0] bg-[#fafbfc]">
        <ToolbarBtn onClick={() => exec('bold')} title="Bold (Ctrl+B)"><Bold size={13} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bulleted list"><List size={13} /></ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered size={13} /></ToolbarBtn>
        <ToolbarBtn onClick={addLink} title="Add link"><Link2 size={13} /></ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder ?? ''}
        onInput={e => { onChange((e.target as HTMLDivElement).innerHTML); detectMention() }}
        onKeyUp={detectMention}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
        style={{ minHeight }}
        className="px-3 py-2 text-[13px] text-[#181818] leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_a]:text-[#2C5485] [&_a]:underline [&_.mention]:text-[#2C5485] [&_.mention]:font-semibold [&_.mention]:bg-[#EFF4FA] [&_.mention]:rounded [&_.mention]:px-1 empty:before:content-[attr(data-placeholder)] empty:before:text-[#A8A8A8]"
      />
      {menu && matches.length > 0 && (
        <div className="fixed z-[100] bg-white border border-[#DDDBDA] rounded-lg shadow-xl py-1 w-56" style={{ top: menu.top, left: menu.left }}>
          {matches.map((u, i) => (
            <button key={u.id} type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(u) }}
              className={'w-full text-left px-3 py-1.5 text-[13px] ' + (i === menu.active ? 'bg-[#EFF4FA] text-[#2C5485]' : 'text-[#181818] hover:bg-[#f8fafc]')}>
              @{u.full_name || 'user'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button type="button" onMouseDown={e => { e.preventDefault(); onClick() }} title={title}
      className="px-1.5 py-1 rounded text-[#3E3E3C] hover:bg-[#f1f5f9] hover:text-[#181818]">
      {children}
    </button>
  )
}
