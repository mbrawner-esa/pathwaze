'use client'
import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Slack, Mail, StickyNote, Calendar, Paperclip, Search, ChevronDown } from 'lucide-react'
import { MessageText, type MentionUser } from '@/components/ui/MessageText'
import { NotesRender } from '@/components/ui/NotesRender'

// Raw project_threads row (Slack mirror + mirrored Outlook email).
export interface ProjectThread {
  id: string
  slack_ts: string | null
  slack_thread_ts: string | null
  user_name: string | null
  user_avatar_url: string | null
  message: string
  created_at: string
  source?: string | null
  subject?: string | null
  from_addr?: string | null
}

// Raw project_notes row (authored note / event / file).
export interface ProjectNote {
  id: string
  type: 'note' | 'event' | 'file'
  title: string | null
  body: string | null
  event_date: string | null
  file_name: string | null
  created_at: string
  user?: { full_name: string | null; avatar_url: string | null } | null
}

type Kind = 'slack' | 'email' | 'note' | 'event' | 'file'

interface FeedItem {
  id: string
  kind: Kind
  created_at: string
  user_name: string | null
  user_avatar_url: string | null
  message?: string
  subject?: string | null
  from_addr?: string | null
  title?: string | null
  body?: string | null
  event_date?: string | null
  file_name?: string | null
}

type SortKey = 'date_desc' | 'date_asc' | 'user' | 'type'
type FilterKind = 'all' | 'slack' | 'email' | 'notes'

const EMAIL_PREVIEW_CHARS = 220

function tsToDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function previewOf(text: string, n = EMAIL_PREVIEW_CHARS): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

function searchText(f: FeedItem): string {
  return [f.user_name, f.message, f.subject, f.from_addr, f.title, f.body, f.file_name]
    .filter(Boolean).join(' ').toLowerCase()
}

export function ThreadsTab({
  threads,
  notes = [],
  channelLinked,
  users = [],
}: {
  threads: ProjectThread[]
  notes?: ProjectNote[]
  channelLinked: boolean
  users?: MentionUser[]
}) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [filter, setFilter] = useState<FilterKind>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const items = useMemo<FeedItem[]>(() => {
    const fromThreads: FeedItem[] = threads.map(t => ({
      id: `thr-${t.id}`,
      kind: t.source === 'email' ? 'email' : 'slack',
      created_at: t.created_at,
      user_name: t.user_name,
      user_avatar_url: t.user_avatar_url,
      message: t.message,
      subject: t.subject,
      from_addr: t.from_addr,
    }))
    const fromNotes: FeedItem[] = notes.map(n => ({
      id: `note-${n.id}`,
      kind: n.type,
      created_at: n.created_at,
      user_name: n.user?.full_name ?? null,
      user_avatar_url: n.user?.avatar_url ?? null,
      title: n.title,
      body: n.body,
      event_date: n.event_date,
      file_name: n.file_name,
    }))
    return [...fromThreads, ...fromNotes]
  }, [threads, notes])

  const visible = useMemo<FeedItem[]>(() => {
    const q = query.trim().toLowerCase()
    const inFilter = (k: Kind) =>
      filter === 'all' ? true
      : filter === 'slack' ? k === 'slack'
      : filter === 'email' ? k === 'email'
      : (k === 'note' || k === 'event' || k === 'file')   // 'notes'
    const list = items
      .filter(f => inFilter(f.kind))
      .filter(f => (q ? searchText(f).includes(q) : true))
    const sorted = [...list]
    if (sort === 'date_desc') sorted.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    else if (sort === 'date_asc') sorted.sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
    else if (sort === 'user') sorted.sort((a, b) => (a.user_name ?? '~').localeCompare(b.user_name ?? '~') || (a.created_at < b.created_at ? 1 : -1))
    else if (sort === 'type') sorted.sort((a, b) => a.kind.localeCompare(b.kind) || (a.created_at < b.created_at ? 1 : -1))
    return sorted
  }, [items, query, sort, filter])

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  if (items.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[14px] font-bold text-[#181818]">Threads</h3>
        </div>
        <div className="px-6 py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F1F5F9] flex items-center justify-center">
            <Mail size={20} className="text-[#70A0D0]" />
          </div>
          <p className="text-[13.5px] text-[#181818] font-semibold">No messages yet</p>
          <p className="text-[12.5px] text-[#706E6B] mt-1 max-w-md mx-auto leading-relaxed">
            {channelLinked
              ? <>Slack messages and stakeholder emails will appear here. You can also add a note, event, or file above.</>
              : <>Add a note, event, or file above — or link a Slack channel (<strong>⋯ menu → Sync Slack channel</strong>) and connect Outlook in <strong>Settings</strong> to mirror conversations here.</>}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header + controls */}
      <div className="px-6 py-3.5 border-b border-[#f1f5f9] flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#181818]">Threads</h3>
          <span className="text-[11px] text-[#94a3b8]">({visible.length}{visible.length !== items.length ? ` of ${items.length}` : ''})</span>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search threads…"
              className="pl-8 pr-3 py-1.5 text-[12.5px] border border-[#e2e8f0] rounded-md w-52 focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
            />
          </div>
          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="py-1.5 pl-2.5 pr-7 text-[12.5px] border border-[#e2e8f0] rounded-md bg-white text-[#3E3E3C]"
            aria-label="Sort threads"
          >
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="user">By user</option>
            <option value="type">By type</option>
          </select>
        </div>

        {/* Source filter chips */}
        <div className="w-full flex items-center gap-1.5">
          {([['all', 'All'], ['slack', 'Slack'], ['email', 'Email'], ['notes', 'Notes & files']] as [FilterKind, string][]).map(([k, label]) => {
            const on = filter === k
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`px-2.5 py-1 text-[11.5px] font-semibold rounded-full border transition-colors ${on ? 'bg-[#EFF6FF] border-[#bfdbfe] text-[#1d4ed8]' : 'bg-white border-[#e2e8f0] text-[#706E6B] hover:bg-[#fafbfc]'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Feed */}
      {visible.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No threads match your search or filter.</div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          {visible.map(f => (
            <FeedRow key={f.id} item={f} users={users} expanded={expanded.has(f.id)} onToggle={() => toggle(f.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function SourceBadge({ kind }: { kind: Kind }) {
  const map: Record<Kind, { label: string; icon: React.ReactNode; cls: string }> = {
    slack: { label: 'Slack', icon: <Slack size={9} />, cls: 'bg-[#F4ECE7] text-[#611f69]' },
    email: { label: 'Email', icon: <Mail size={9} />, cls: 'bg-[#EFF6FF] text-[#1d4ed8]' },
    note:  { label: 'Note',  icon: <StickyNote size={9} />, cls: 'bg-[#F1F5F9] text-[#475569]' },
    event: { label: 'Event', icon: <Calendar size={9} />, cls: 'bg-[#FEF3C7] text-[#92400e]' },
    file:  { label: 'File',  icon: <Paperclip size={9} />, cls: 'bg-[#ECFDF5] text-[#047857]' },
  }
  const b = map[kind]
  return (
    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${b.cls}`}>
      {b.icon} {b.label}
    </span>
  )
}

function FeedRow({ item, users, expanded, onToggle }: { item: FeedItem; users: MentionUser[]; expanded: boolean; onToggle: () => void }) {
  const isEmail = item.kind === 'email'
  const isSlack = item.kind === 'slack'
  const fallbackName = isEmail ? 'Email' : isSlack ? 'Slack user' : 'Someone'
  const longEmail = isEmail && (item.message?.length ?? 0) > EMAIL_PREVIEW_CHARS

  return (
    <div className="flex gap-3">
      <Avatar name={item.user_name ?? fallbackName} imageUrl={item.user_avatar_url} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-[#181818]">{item.user_name ?? fallbackName}</span>
          <span className="text-[10.5px] text-[#706E6B]">{tsToDate(item.created_at)}</span>
          <SourceBadge kind={item.kind} />
        </div>

        {/* Email — collapsed by default */}
        {isEmail && (
          <>
            {item.subject && <p className="text-[12.5px] font-semibold text-[#181818] mt-0.5">{item.subject}</p>}
            {item.from_addr && <p className="text-[10.5px] text-[#94a3b8] mt-0.5">from {item.from_addr}</p>}
            <p className={`text-[13px] text-[#181818] mt-0.5 ${expanded ? 'whitespace-pre-wrap' : ''}`}>
              {expanded ? item.message : previewOf(item.message ?? '')}
            </p>
            {longEmail && (
              <button
                onClick={onToggle}
                className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#1d4ed8] hover:underline"
              >
                {expanded ? 'Show less' : 'Read more'}
                <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </>
        )}

        {/* Slack */}
        {isSlack && (
          <p className="text-[13px] text-[#181818] mt-0.5 whitespace-pre-wrap">
            <MessageText text={item.message ?? ''} users={users} />
          </p>
        )}

        {/* Note / Event / File */}
        {(item.kind === 'note' || item.kind === 'event' || item.kind === 'file') && (
          <>
            {item.title && <p className="text-[12.5px] font-semibold text-[#181818] mt-0.5">{item.title}</p>}
            {item.body && <div className="mt-0.5"><NotesRender source={item.body} /></div>}
            {item.kind === 'event' && item.event_date && (
              <p className="text-[11.5px] text-[#706E6B] mt-0.5">📅 {new Date(item.event_date).toLocaleDateString()}</p>
            )}
            {item.kind === 'file' && item.file_name && (
              <p className="text-[11.5px] text-[#706E6B] mt-0.5">📎 {item.file_name}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
