'use client'

// The conversation attached to one milestone.
//
// This is where the instructions live — why something is a focus, what "done"
// looks like, what changed since last week. Deliberately NOT the milestone's
// `notes` field: notes are one body where the last writer wins, so a
// back-and-forth there overwrites itself.
//
// Loaded on demand rather than with the board. Every project carries ~20
// milestones, so eagerly fetching every thread would be hundreds of rows the
// reader will never open; the board ships only the COUNT, which is what tells
// you a thread is worth opening.

import { useCallback, useEffect, useState } from 'react'
import { Trash2, AlertTriangle } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { NotesRender } from '@/components/ui/NotesRender'
import { Avatar } from '@/components/ui/Avatar'
import { timeAgo } from '@/lib/utils'

interface Comment {
  id: string
  body: string
  created_at: string
  user_id: string | null
  users?: { full_name: string; avatar_url: string | null } | null
}

/** Empty rich text is `<p></p>`, not '' — check the text, not the markup. */
function hasText(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}

export function CommentThread({ milestoneId, label }: { milestoneId: string; label: string }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/workstreams/comments?milestone_id=${encodeURIComponent(milestoneId)}`)
      if (!res.ok) { setError('Could not load the thread.'); return }
      const body = await res.json()
      setComments(body.comments ?? [])
    } catch {
      setError('Could not load the thread.')
    }
  }, [milestoneId])

  useEffect(() => { load() }, [load])

  async function post() {
    if (!hasText(draft)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/workstreams/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone_id: milestoneId, body: draft }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setError(b.error || 'That did not post.')
        return
      }
      setDraft('')
      await load()
    } catch {
      setError('That did not post.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/workstreams/comments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) setError('Could not delete that comment.')
      else await load()
    } catch {
      setError('Could not delete that comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg bg-white border border-[#EDF1F5] p-3.5">
      <p className="m-0 mb-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">
        Context · {label}
      </p>

      {error && (
        <div className="flex items-start gap-2 mb-2 px-2.5 py-1.5 rounded text-[11.5px] bg-[#FEF2F2] text-[#991B1B]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {comments === null ? (
        <p className="m-0 text-[11.5px] text-[#94a3b8]">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="m-0 mb-3 text-[11.5px] text-[#94a3b8]">
          No context yet. Add what the team needs to know to pick this up.
        </p>
      ) : (
        <ul className="list-none m-0 p-0 mb-3 flex flex-col gap-2.5">
          {comments.map(c => (
            <li key={c.id} className="group/c flex items-start gap-2.5">
              <Avatar name={c.users?.full_name ?? 'Someone'} imageUrl={c.users?.avatar_url ?? null} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="m-0 text-[11px] text-[#706E6B]">
                  <span className="font-semibold text-[#3E3E3C]">{c.users?.full_name ?? 'Someone'}</span>
                  {' · '}{timeAgo(c.created_at)}
                </p>
                <NotesRender source={c.body} className="text-[12px] mt-0.5" />
              </div>
              {/* Delete is author-only server-side; showing it to everyone and
                  letting RLS refuse would be a button that lies. */}
              <button
                type="button"
                onClick={() => remove(c.id)}
                disabled={busy}
                aria-label="Delete comment"
                className="opacity-0 group-hover/c:opacity-100 focus:opacity-100 transition-opacity text-[#C6D0DA] hover:text-[#b91c1c] shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RichTextEditor
        value={draft}
        onChange={setDraft}
        placeholder="Add context or instructions…"
        minHeight={64}
      />
      <div className="flex justify-end mt-2">
        <button
          type="button"
          onClick={post}
          disabled={busy || !hasText(draft)}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#70A0D0] text-white hover:bg-[#2C5485] disabled:opacity-40"
        >
          {busy ? 'Posting…' : 'Comment'}
        </button>
      </div>
    </div>
  )
}
