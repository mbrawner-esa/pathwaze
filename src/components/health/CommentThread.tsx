'use client'

// The conversation attached to one milestone.
//
// This is where instructions live — why something is a focus, what "done"
// looks like, what changed. Deliberately NOT the milestone's `notes` field:
// notes are one body where the last writer wins, so a back-and-forth there
// overwrites itself.
//
// It uses the SAME mention system as task threads: `MentionInput` to compose
// and `MessageText` to render, which store mentions as `<@USERID>` tokens.
// The app has two mention systems (see CLAUDE.md) and picking the wrong one
// here would mean an @-name that renders as a name in tasks and as raw markup
// here.
//
// Loaded on demand rather than with the board. Every project carries ~20
// milestones, so eagerly fetching every thread would be hundreds of rows the
// reader will never open; the board ships only the COUNT, which is what tells
// you a thread is worth opening.

import { useCallback, useEffect, useState } from 'react'
import { Send, Trash2, Pencil, AlertTriangle, MessageSquare } from 'lucide-react'
import { MentionInput } from '@/components/ui/MentionInput'
import { MessageText } from '@/components/ui/MessageText'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

interface Comment {
  id: string
  body: string
  created_at: string
  edited_at: string | null
  user_id: string | null
  users?: { full_name: string; avatar_url: string | null } | null
}

export interface ThreadUser { id: string; full_name: string; avatar_url?: string | null }

export function CommentThread({
  milestoneId, users, currentUserId,
}: {
  milestoneId: string
  users: ThreadUser[]
  currentUserId: string
}) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
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

  async function send() {
    if (!draft.trim()) return
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

  async function saveEdit() {
    if (!editingId || !editingText.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/workstreams/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, body: editingText }),
      })
      if (!res.ok) setError('Could not save that edit.')
      else { setEditingId(null); setEditingText(''); await load() }
    } catch {
      setError('Could not save that edit.')
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
    <div className="rounded-lg bg-white border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center gap-2">
        <MessageSquare size={13} className="text-[#3E3E3C]" />
        <span className="text-[12.5px] font-semibold text-[#181818]">Thread</span>
        <span className="text-[11px] text-[#706E6B]">{comments?.length ?? 0}</span>
        <span className="ml-auto text-[10.5px] text-[#94a3b8]">Type @ to mention someone</span>
      </div>

      <div className="px-4 py-3">
        {comments === null ? (
          <p className="text-xs text-[#706E6B]">Loading…</p>
        ) : (
          <div className="space-y-3 mb-3">
            {comments.map(c => {
              const editing = editingId === c.id
              // Edit and delete are author-only server-side; showing them to
              // everyone and letting RLS refuse would be a button that lies.
              const mine = c.user_id === currentUserId
              return (
                <div key={c.id} className="flex gap-2.5 group/c">
                  <Avatar name={c.users?.full_name ?? 'User'} imageUrl={c.users?.avatar_url ?? null} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold text-[#181818]">{c.users?.full_name ?? 'User'}</span>
                      <span className="text-[10.5px] text-[#706E6B]">{formatDate(c.created_at)}</span>
                      {c.edited_at && (
                        <span className="text-[10px] text-[#94a3b8] italic" title={`Edited ${formatDate(c.edited_at)}`}>edited</span>
                      )}
                      {!editing && mine && (
                        <span className="ml-auto flex items-center gap-1 opacity-0 group-hover/c:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingId(c.id); setEditingText(c.body) }} title="Edit message"
                            className="p-1 rounded text-[#A8A8A8] hover:text-[#2C5485] hover:bg-[#EFF4FA]">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => remove(c.id)} title="Delete message"
                            className="p-1 rounded text-[#A8A8A8] hover:text-[#b91c1c] hover:bg-[#FEF2F2]">
                            <Trash2 size={11} />
                          </button>
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div className="mt-1">
                        <MentionInput value={editingText} onChange={setEditingText} onSubmit={saveEdit}
                          users={users} placeholder="Edit your message…"
                          className="px-3 py-2 border border-[#cbd5e1] rounded text-[12.5px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={saveEdit} disabled={busy} className="btn-primary text-[12px] px-2.5 py-1">Save</button>
                          <button onClick={() => { setEditingId(null); setEditingText('') }}
                                  className="btn-secondary text-[12px] px-2.5 py-1">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-[#181818] mt-0.5">
                        <MessageText text={c.body} users={users} />
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            {comments.length === 0 && (
              <p className="text-xs text-[#706E6B] py-1">
                No messages yet — add the context the team needs to pick this up.
              </p>
            )}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <MentionInput value={draft} onChange={setDraft} onSubmit={send} users={users}
            placeholder="Add a message…  (type @ to mention)"
            className="px-3 py-2 border border-[#cbd5e1] rounded text-[12.5px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
          <button onClick={send} disabled={busy || !draft.trim()}
                  className="p-2 bg-[#70A0D0] text-white rounded hover:bg-[#2C5485] transition-colors disabled:opacity-40">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
