'use client'
/**
 * Rich text editor with bullet / numbered list / bold toolbar buttons.
 * Uses contentEditable + execCommand under the hood; the saved value is HTML.
 *
 * Pair with NotesRender (./NotesRender.tsx) to display saved content with
 * graceful fallback to plain-text markdown lists for legacy notes.
 */
import { useEffect, useRef } from 'react'
import { List, ListOrdered, Bold, Link2 } from 'lucide-react'

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Set the initial HTML only once on mount; React doesn't manage contentEditable.
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

  return (
    <div className="border border-[#cbd5e1] rounded focus-within:border-[#70A0D0] focus-within:ring-2 focus-within:ring-[#70A0D0]/20 bg-white">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#e2e8f0] bg-[#fafbfc]">
        <ToolbarBtn onClick={() => exec('bold')} title="Bold (Ctrl+B)">
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertUnorderedList')} title="Bulleted list">
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec('insertOrderedList')} title="Numbered list">
          <ListOrdered size={13} />
        </ToolbarBtn>
        <ToolbarBtn onClick={addLink} title="Add link">
          <Link2 size={13} />
        </ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder ?? ''}
        onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
        style={{ minHeight }}
        className="px-3 py-2 text-[13px] text-[#181818] leading-relaxed focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-[#A8A8A8]"
      />
    </div>
  )
}

function ToolbarBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="px-1.5 py-1 rounded text-[#3E3E3C] hover:bg-[#f1f5f9] hover:text-[#181818]"
    >
      {children}
    </button>
  )
}
