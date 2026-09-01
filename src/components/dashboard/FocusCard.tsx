// This week's focus, on everyone's dashboard.
//
// The portfolio board is manager-only, so the decisions made there would
// otherwise be invisible to the people delivering the work. This is the other
// half: the same shared list, read-only, at the top of the page every team
// member already opens.

import Link from 'next/link'
import { formatShortDate } from '@/lib/utils'

export interface FocusItem {
  milestoneId: string
  label: string
  projectId: string
  projectName: string
  majorLabel: string
  workstream: string
  status: string
  endDate: string | null
  isCritical: boolean
  comments: number
}

const LANE_HUE: Record<string, string> = {
  commercial: '#6E879E',
  technical: '#C8963A',
  approvals: '#2F3E50',
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  complete: 'Complete',
}

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  not_started: { bg: '#EEF2F6', border: '#D7E0E8', text: '#61758A' },
  in_progress: { bg: '#FDF0D5', border: '#E6C87A', text: '#8A6519' },
  blocked:     { bg: '#FEF0C7', border: '#F3D08A', text: '#92400E' },
  complete:    { bg: '#DCFCE7', border: '#86D3A6', text: '#166534' },
}

export function FocusCard({ items }: { items: FocusItem[] }) {
  // Nothing marked means no card at all. An empty "This week's focus" heading
  // reads as a broken feature; its absence reads as "nobody has set one yet",
  // which is the truth.
  if (items.length === 0) return null

  return (
    <section className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden mb-6"
             style={{ borderLeft: '3px solid #E6C87A' }}>
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#f1f5f9]">
        <div>
          <h2 className="text-[15px] font-semibold text-[#181818]">This week&apos;s focus</h2>
          <p className="text-[12px] text-[#706E6B] mt-0.5">
            {items.length} milestone{items.length === 1 ? '' : 's'} the team is driving
          </p>
        </div>
      </div>

      <ul className="list-none m-0 p-0">
        {items.map(f => (
          <li key={f.milestoneId}
              className="flex items-center gap-3 px-6 py-2.5 border-b border-[#F8FAFC] last:border-0 hover:bg-[#fafbfc]">
            <i className="block w-[3px] h-[16px] rounded-sm shrink-0"
               style={{ background: LANE_HUE[f.workstream] ?? '#C6D0DA' }} />

            <div className="flex-1 min-w-0">
              <Link
                href={`/projects/${f.projectId}?tab=workstreams&ws=${f.workstream}`}
                className="text-[13.5px] font-medium text-[#181818] hover:text-[#2C5485] hover:underline truncate block"
              >
                {f.label}
              </Link>
              <p className="text-[11.5px] text-[#706E6B] m-0 mt-0.5 truncate">
                {f.projectName} · {f.majorLabel}
                {f.comments > 0 && ` · ${f.comments} comment${f.comments === 1 ? '' : 's'}`}
              </p>
            </div>

            {f.isCritical && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-[0.05em]
                               bg-[#F3EEFC] text-[#5B21B6] border border-[#DDD0F2]">
                Critical
              </span>
            )}

            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border w-[68px] text-center truncate"
                  style={STATUS_STYLE[f.status] ?? STATUS_STYLE.not_started}>
              {STATUS_LABEL[f.status] ?? f.status}
            </span>

            <span className="shrink-0 w-[62px] text-right text-[11.5px] tabular-nums text-[#706E6B]">
              {f.endDate ? formatShortDate(f.endDate) : '—'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
