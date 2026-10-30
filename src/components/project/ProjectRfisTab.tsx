'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { formatDate, isPastDue } from '@/lib/utils'

export interface ProjectRfi {
  id: string
  rfi_number: number
  subject: string
  status: string
  priority?: string | null
  due_date: string | null
  ball_user?: { id: string; full_name: string | null } | null
  ball_sh?: { id: string; name: string | null } | null
}

const rfiNo = (n: number) => '#' + String(n ?? 0).padStart(3, '0')
const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  open:   { bg: '#EFF6FF', text: '#1d4ed8', label: 'Open' },
  draft:  { bg: '#FFFBEB', text: '#92400e', label: 'Draft' },
  closed: { bg: '#F0FDF4', text: '#166534', label: 'Closed' },
}
const isOverdue = (r: ProjectRfi) => r.status === 'open' && isPastDue(r.due_date)

export function ProjectRfisTab({ rfis = [], projectId }: { rfis: ProjectRfi[]; projectId: string }) {
  const [showClosed, setShowClosed] = useState(false)
  const closed = rfis.filter(r => r.status === 'closed')
  const live = rfis.filter(r => r.status !== 'closed')
  const shown = showClosed ? rfis : live

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center gap-3 flex-wrap">
        <h3 className="text-[14px] font-bold text-[#181818]">RFIs</h3>
        <span className="text-[11px] text-[#94a3b8]">({live.length} open{closed.length ? ` · ${closed.length} closed` : ''})</span>
        <div className="ml-auto flex items-center gap-3">
          {closed.length > 0 && (
            <label className="flex items-center gap-1.5 text-[12px] text-[#3E3E3C] cursor-pointer select-none">
              <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} className="w-3.5 h-3.5 rounded border-[#cbd5e1]" />
              Show closed
            </label>
          )}
          <Link href={`/rfis?project=${projectId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#2C5485] hover:underline">
            Open in RFI log <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-[13.5px] text-[#181818] font-semibold">{rfis.length === 0 ? 'No RFIs on this project' : 'No open RFIs'}</p>
          <p className="text-[12.5px] text-[#706E6B] mt-1">Create one from the <Link href="/rfis" className="font-semibold text-[#2C5485] hover:underline">RFI log</Link>.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f1f5f9]">
          {shown.map(r => <RfiRow key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}

function RfiRow({ r }: { r: ProjectRfi }) {
  const overdue = isOverdue(r)
  const st = STATUS_PILL[r.status] ?? STATUS_PILL.open
  const assignee = r.ball_user?.full_name || r.ball_sh?.name || null
  return (
    <Link href={`/rfis/${r.id}`} className="flex items-center gap-3 px-6 py-2.5 hover:bg-[#f8fafc] transition-colors">
      <span className="text-[12.5px] font-extrabold text-[#2C5485] w-12 flex-shrink-0">{rfiNo(r.rfi_number)}</span>
      <span className={`flex-1 min-w-0 truncate text-[13px] ${r.status === 'closed' ? 'text-[#94a3b8]' : 'text-[#181818]'}`}>{r.subject}</span>
      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
        style={overdue ? { background: '#FEF2F2', color: '#b91c1c' } : { background: st.bg, color: st.text }}>
        {overdue ? 'Overdue' : st.label}
      </span>
      <span className="text-[12px] text-[#3E3E3C] flex-shrink-0 w-36 truncate" title="Ball in court">{assignee ?? <span className="text-[#cbd5e1]">—</span>}</span>
      <span className={`text-[11.5px] flex-shrink-0 w-24 text-right ${overdue ? 'text-[#b91c1c] font-semibold' : 'text-[#706E6B]'}`}>
        {r.due_date ? formatDate(r.due_date) : '—'}
      </span>
    </Link>
  )
}
