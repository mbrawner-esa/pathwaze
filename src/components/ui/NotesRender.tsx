'use client'
/**
 * Render notes/description content saved by RichTextEditor.
 *
 * New notes are HTML (from contentEditable, e.g. "<ul><li>foo</li></ul>").
 * Legacy notes are plain text — possibly with markdown-style list lines.
 * This component detects the format and renders both correctly.
 */
import React from 'react'

export function NotesRender({ source, className }: { source: string; className?: string }) {
  const trimmed = source.trim()
  // HTML from the rich editor — render directly. The editor only inserts
  // whitelisted tags (p, ul, ol, li, br, b, i, etc.) so dangerouslySetInnerHTML
  // is safe for our own content.
  if (/<(p|ul|ol|li|br|b|strong|i|em|div|span)\b/i.test(trimmed)) {
    return (
      <div
        className={`text-[13px] text-[#181818] leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1.5 [&_a]:text-[#2C5485] [&_a]:underline [&_.mention]:text-[#2C5485] [&_.mention]:font-semibold [&_.mention]:bg-[#EFF4FA] [&_.mention]:rounded [&_.mention]:px-1 ${className ?? ''}`}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    )
  }
  // Plain text — preserve markdown-style list lines for legacy notes.
  return <LegacyNotesRender source={source} className={className} />
}

function LegacyNotesRender({ source, className }: { source: string; className?: string }) {
  type Block =
    | { kind: 'p'; text: string }
    | { kind: 'ul'; items: string[] }
    | { kind: 'ol'; items: string[] }

  const blocks: Block[] = []
  let currentList: Block | null = null
  let currentPara: string[] = []
  function flushPara() {
    if (currentPara.length) {
      blocks.push({ kind: 'p', text: currentPara.join('\n') })
      currentPara = []
    }
  }
  function flushList() {
    if (currentList) {
      blocks.push(currentList)
      currentList = null
    }
  }
  for (const line of source.split('\n')) {
    if (line.trim() === '') { flushPara(); flushList(); continue }
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ul) {
      flushPara()
      if (!currentList || currentList.kind !== 'ul') { flushList(); currentList = { kind: 'ul', items: [] } }
      currentList.items.push(ul[1])
    } else if (ol) {
      flushPara()
      if (!currentList || currentList.kind !== 'ol') { flushList(); currentList = { kind: 'ol', items: [] } }
      currentList.items.push(ol[1])
    } else {
      flushList()
      currentPara.push(line)
    }
  }
  flushPara(); flushList()

  return (
    <div className={`text-[13px] text-[#181818] space-y-2 ${className ?? ''}`}>
      {blocks.map((b, i) => {
        if (b.kind === 'p') return <p key={i} className="whitespace-pre-wrap leading-relaxed">{b.text}</p>
        if (b.kind === 'ul') return (
          <ul key={i} className="list-disc pl-5 space-y-0.5">
            {b.items.map((it, j) => <li key={j} className="leading-relaxed">{it}</li>)}
          </ul>
        )
        return (
          <ol key={i} className="list-decimal pl-5 space-y-0.5">
            {b.items.map((it, j) => <li key={j} className="leading-relaxed">{it}</li>)}
          </ol>
        )
      })}
    </div>
  )
}
