'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { ExternalLink } from 'lucide-react'

export interface ProjectTask {
  id: string
  title: string
  type: string
  status: string
  priority: string
  due_date: string | null
  assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

const PRIORITY_COLORS: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#94a3b8' }
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  Design: { bg: '#EEF2FF', text: '#3730A3' },
  Engineering: { bg: '#DBEAFE', text: '#1E40AF' },
  Permitting: { bg: '#FEF3C7', text: '#92400E' },
  Interconnection: { bg: '#D1FAE5', text: '#047857' },
  Financial: { bg: '#FCE7F3', text: '#9D174D' },
  Legal: { bg: '#E0E7FF', text: '#4338CA' },
  Construction: { bg: '#FFEDD5', text: '#9A3412' },
  Operations: { bg: '#F1F5F9', text: '#475569' },
  Administrative: { bg: '#F3F4F6', text: '#374151' },
}
// Kanban order; 'Complete' is handled separately (hidden unless toggled on).
const OPEN_STATUS_ORDER = ['Draft', 'Pending Info', 'Ready to Start', 'In Progress', 'Under Review']
const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  Draft: { bg: '#F1F5F9', text: '#475569' },
  'Pending Info': { bg: '#FEF9C3', text: '#854d0e' },
  'Ready to Start': { bg: '#E0E7FF', text: '#4338CA' },
  'In Progress': { bg: '#DBEAFE', text: '#1E40AF' },
  'Under Review': { bg: '#FDF4FF', text: '#7e22ce' },
  Complete: { bg: '#F0FDF4', text: '#166534' },
}

function fmtDue(s: string): string {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
const todayISO = () => new Date().toISOString().slice(0, 10)

export function ProjectTasksTab({ tasks = [], projectId }: { tasks: ProjectTask[]; projectId: string }) {
  const [showDone, setShowDone] = useState(false)
  const open = tasks.filter(t => t.status !== 'Complete')
  const done = tasks.filter(t => t.status === 'Complete')

  const grouped = OPEN_STATUS_ORDER
    .map(status => ({ status, items: open.filter(t => t.status === status) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center gap-3 flex-wrap">
        <h3 className="text-[14px] font-bold text-[#181818]">Tasks</h3>
        <span className="text-[11px] text-[#94a3b8]">({open.length} open{done.length ? ` · ${done.length} done` : ''})</span>
        <div className="ml-auto flex items-center gap-3">
          {done.length > 0 && (
            <label className="flex items-center gap-1.5 text-[12px] text-[#3E3E3C] cursor-pointer select-none">
              <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="w-3.5 h-3.5 rounded border-[#cbd5e1]" />
              Show completed
            </label>
          )}
          <Link href={`/tasks?project=${projectId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2C5485] hover:underline">
            Open in Task Tracker <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {open.length === 0 && !showDone ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[13.5px] text-[#181818] font-semibold">No open tasks</p>
          <p className="text-[12.5px] text-[#706E6B] mt-1">Add one with <strong>Add Task</strong> above, or from the Threads tab.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f1f5f9]">
          {grouped.map(g => (
            <TaskGroup key={g.status} status={g.status} items={g.items} />
          ))}
          {showDone && done.length > 0 && <TaskGroup status="Complete" items={done} />}
        </div>
      )}
    </div>
  )
}

function TaskGroup({ status, items }: { status: string; items: ProjectTask[] }) {
  const pill = STATUS_PILL[status] ?? STATUS_PILL['Draft']
  return (
    <div>
      <div className="px-6 pt-4 pb-2 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: pill.bg, color: pill.text }}>{status}</span>
        <span className="text-[11px] text-[#94a3b8]">{items.length}</span>
      </div>
      <div>
        {items.map(t => <TaskRow key={t.id} t={t} />)}
      </div>
    </div>
  )
}

function TaskRow({ t }: { t: ProjectTask }) {
  const type = TYPE_COLORS[t.type] ?? TYPE_COLORS['Administrative']
  const overdue = !!t.due_date && t.status !== 'Complete' && t.due_date < todayISO()
  return (
    <Link
      href={`/tasks?id=${t.id}`}
      className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#f8fafc] transition-colors"
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[t.priority] ?? '#94a3b8' }} title={`${t.priority} priority`} />
      <span className={`flex-1 min-w-0 truncate text-[13px] ${t.status === 'Complete' ? 'text-[#94a3b8] line-through' : 'text-[#181818]'}`}>{t.title}</span>
      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: type.bg, color: type.text }}>{t.type}</span>
      {t.due_date && (
        <span className={`text-[11.5px] flex-shrink-0 w-24 text-right ${overdue ? 'text-[#b91c1c] font-semibold' : 'text-[#706E6B]'}`}>
          {fmtDue(t.due_date)}
        </span>
      )}
      <span className="flex-shrink-0 w-7 flex justify-end">
        {t.assignee ? <Avatar name={t.assignee.full_name ?? '—'} imageUrl={t.assignee.avatar_url} size="sm" /> : <span className="text-[11px] text-[#cbd5e1]">—</span>}
      </span>
    </Link>
  )
}
