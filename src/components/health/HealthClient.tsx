'use client'

// The pipeline-health page body.
//
// Two halves, in this order on purpose:
//   1. WHAT MOVED — the week's movements, grouped by project, worst first.
//   2. WHERE EVERYTHING STANDS — current state for every live project.
//
// Movement leads because state is already available elsewhere: /projects shows
// deal health and next milestone in a sortable table. What no other page can
// say is which of those changed, and which way. If the feed is empty the state
// table still carries the page, so this never renders as a blank screen.

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowDownRight, ArrowUpRight, Minus, AlertTriangle, Lock, Info,
} from 'lucide-react'
import { StageBadge } from '@/components/ui/StageBadge'
import { DealHealthBadge } from '@/components/ui/DealHealthBadge'
import { formatShortDate, timeAgo } from '@/lib/utils'
import { varianceLabel } from '@/lib/workstreams'
import type { Direction, ProjectMovements } from '@/lib/health-feed'

export interface HealthProject {
  id: string
  name: string
  projectNumber: string | null
  stage: string
  dealHealth: string
  dealHealthOverride: boolean
  suggestedHealth: string
  suggestionReason: string
  city: string | null
  state: string | null
  assigneeName: string | null
  nextMilestone: string | null
  nextMilestoneDate: string | null
  nextMilestoneVariance: number | null
  /** worst slip in days across the project's majors; 0 when nothing has slipped */
  worstSlip: number
  overdueCount: number
  blockedCount: number
}

interface Summary {
  projectsMoved: number
  projectsWorse: number
  projectsBetter: number
  movements: number
}

const DIRECTION_STYLE: Record<Direction, { fg: string; bg: string; label: string }> = {
  worse:   { fg: '#b91c1c', bg: '#FEF2F2', label: 'Needs attention' },
  better:  { fg: '#15803d', bg: '#F0FDF4', label: 'Improved' },
  neutral: { fg: '#475569', bg: '#F8FAFC', label: 'Other movement' },
}

function DirectionIcon({ direction }: { direction: Direction }) {
  const s = DIRECTION_STYLE[direction]
  const Icon = direction === 'worse' ? ArrowDownRight : direction === 'better' ? ArrowUpRight : Minus
  return (
    <span
      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: s.bg }}
    >
      <Icon size={12} strokeWidth={2.5} style={{ color: s.fg }} />
    </span>
  )
}

type Filter = 'all' | Direction

export function HealthClient({
  days,
  windows,
  groups,
  summary,
  projects,
  actorNames,
  historyStartsAt,
  windowPredatesHistory,
}: {
  days: number
  windows: number[]
  groups: ProjectMovements[]
  summary: Summary
  projects: HealthProject[]
  actorNames: Record<string, string>
  historyStartsAt: string
  windowPredatesHistory: boolean
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const projectById = new Map(projects.map(p => [p.id, p]))

  // Filtering hides whole project groups rather than thinning them: a group
  // showing one of a project's four movements would misrepresent the week for
  // that project, which is the opposite of what this page is for.
  const visible = filter === 'all' ? groups : groups.filter(g => g.direction === filter)

  return (
    <div className="px-8 py-10">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#181818] leading-tight">Pipeline health</h1>
          <p className="text-[14px] text-[#3E3E3C] mt-1.5">
            What moved across the portfolio in the last {days} days, and where every project stands now.
          </p>
        </div>
        {/* Window selector — server-side, so the query re-runs against the
            wider range rather than filtering a 7-day fetch client-side. */}
        <div className="flex items-center gap-1 bg-white border border-[#e2e8f0] rounded-lg p-1">
          {windows.map(w => (
            <Link
              key={w}
              href={`/health?days=${w}`}
              className={
                'px-3 py-1 rounded-md text-[12.5px] font-medium transition-colors ' +
                (w === days ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')
              }
            >
              {w}d
            </Link>
          ))}
        </div>
      </div>

      {/* ── Summary tiles ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatTile label="Projects moved" value={summary.projectsMoved} sub={`of ${projects.length} live`} />
        <StatTile label="Needing attention" value={summary.projectsWorse} tone="worse" />
        <StatTile label="Improved" value={summary.projectsBetter} tone="better" />
        <StatTile label="Total changes" value={summary.movements} sub={`in ${days} days`} />
      </div>

      {/* The log only reaches back so far. Saying so is the difference between
          "a quiet week" and "we weren't recording yet" — a reader cannot tell
          those apart from an empty feed, and would reasonably assume the first. */}
      {windowPredatesHistory && (
        <div className="flex items-start gap-2.5 mb-6 px-4 py-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
          <Info size={15} className="text-[#92400e] mt-0.5 flex-shrink-0" />
          <p className="text-[12.5px] text-[#92400e] leading-snug m-0">
            Change history begins {formatShortDate(historyStartsAt)}, when field-level logging went live.
            This window reaches back further, so anything before that date is missing rather than quiet.
          </p>
        </div>
      )}

      {/* ── What moved ── */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-[17px] font-semibold text-[#181818]">What moved</h2>
        <div className="flex items-center gap-1">
          {(['all', 'worse', 'better', 'neutral'] as Filter[]).map(f => {
            const count = f === 'all' ? groups.length : groups.filter(g => g.direction === f).length
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  'px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors border ' +
                  (active
                    ? 'bg-[#2F3E50] text-white border-[#2F3E50]'
                    : 'bg-white text-[#55677A] border-[#e2e8f0] hover:bg-[#f8fafc]')
                }
              >
                {f === 'all' ? 'All' : DIRECTION_STYLE[f].label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] px-6 py-12 text-center mb-10">
          <p className="text-[13.5px] text-[#3E3E3C] m-0">
            {groups.length === 0
              ? `Nothing moved in the last ${days} days.`
              : `No ${DIRECTION_STYLE[filter as Direction].label.toLowerCase()} in this window.`}
          </p>
          <p className="text-[12px] text-[#706E6B] mt-1.5 m-0">
            Health changes, stage moves, milestone slips, blocks and risk flags all land here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-10">
          {visible.map(group => {
            const p = projectById.get(group.projectId)
            if (!p) return null
            const s = DIRECTION_STYLE[group.direction]
            return (
              <section
                key={group.projectId}
                className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden"
                style={{ borderLeft: `3px solid ${s.fg}` }}
              >
                <div className="px-5 py-3.5 flex items-center gap-3 border-b border-[#f1f5f9] flex-wrap">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-[14.5px] font-semibold text-[#181818] hover:text-[#2C5485] hover:underline"
                  >
                    {p.name}
                  </Link>
                  {p.projectNumber && (
                    <span className="text-[11.5px] text-[#706E6B] font-mono">{p.projectNumber}</span>
                  )}
                  <DealHealthBadge health={p.dealHealth} />
                  <StageBadge stage={p.stage} />
                  <span className="ml-auto text-[11.5px] font-medium" style={{ color: s.fg }}>
                    {group.worse > 0 && `${group.worse} worse`}
                    {group.worse > 0 && group.better > 0 && ' · '}
                    {group.better > 0 && `${group.better} better`}
                    {group.worse === 0 && group.better === 0 && `${group.neutral} change${group.neutral === 1 ? '' : 's'}`}
                  </span>
                </div>
                <ul className="list-none m-0 p-0">
                  {group.movements.map(m => (
                    <li key={m.id} className="flex items-start gap-3 px-5 py-2.5 border-b border-[#f8fafc] last:border-b-0">
                      <span className="mt-0.5"><DirectionIcon direction={m.direction} /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] text-[#181818] m-0 leading-snug">{m.headline}</p>
                        {m.detail && (
                          <p className="text-[11.5px] text-[#706E6B] m-0 mt-0.5">{m.detail}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-[#94a3b8] flex-shrink-0 text-right leading-snug">
                        {m.actorId && actorNames[m.actorId] && (
                          <>{actorNames[m.actorId]}<br /></>
                        )}
                        {timeAgo(m.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Where everything stands ── */}
      <h2 className="text-[17px] font-semibold text-[#181818] mb-1">Where everything stands</h2>
      <p className="text-[12.5px] text-[#706E6B] mb-4">
        Current state for all {projects.length} live projects. Health is the value a person set;
        the flag marks where Workstreams disagrees.
      </p>
      <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e2e8f0]">
                <Th>Project</Th>
                <Th>Health</Th>
                <Th>Stage</Th>
                <Th>Next milestone</Th>
                <Th align="right">Variance</Th>
                <Th align="right">Worst slip</Th>
                <Th>Flags</Th>
                <Th align="right">Moved</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const group = groups.find(g => g.projectId === p.id)
                // Same rule as EditableDealHealth, so the two surfaces never
                // disagree about whether there is a disagreement: a suggestion
                // is only worth flagging when it has an opinion and that
                // opinion differs from the value on record.
                const mismatch = p.suggestedHealth !== 'TBD' && p.suggestedHealth !== p.dealHealth
                return (
                  <tr key={p.id} className="border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc]">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${p.id}`} className="text-[13.5px] font-medium text-[#181818] hover:text-[#2C5485] hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-[11px] text-[#706E6B] m-0 mt-0.5">
                        {[p.city, p.state].filter(Boolean).join(', ') || '—'}
                        {p.assigneeName && ` · ${p.assigneeName}`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <DealHealthBadge health={p.dealHealth} />
                        {p.dealHealthOverride ? (
                          <span title="Set by hand, against what the workstreams suggest.">
                            <Lock size={11} className="text-[#94a3b8]" />
                          </span>
                        ) : mismatch ? (
                          <span title={`Workstreams suggest ${p.suggestedHealth}. ${p.suggestionReason}`}>
                            <AlertTriangle size={12} className="text-[#d97706]" />
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StageBadge stage={p.stage} /></td>
                    <td className="px-4 py-3">
                      {p.nextMilestone ? (
                        <>
                          <p className="text-[12.5px] text-[#181818] m-0 truncate max-w-[220px]">{p.nextMilestone}</p>
                          <p className="text-[11px] text-[#706E6B] m-0 mt-0.5">{formatShortDate(p.nextMilestoneDate)}</p>
                        </>
                      ) : <span className="text-[12.5px] text-[#94a3b8]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[12.5px]"
                        style={{ color: (p.nextMilestoneVariance ?? 0) < 0 ? '#b91c1c' : '#3E3E3C' }}>
                      {varianceLabel(p.nextMilestoneVariance) ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[12.5px]"
                        style={{ color: p.worstSlip > 0 ? '#b91c1c' : '#94a3b8' }}>
                      {p.worstSlip > 0 ? `${p.worstSlip}d` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {p.overdueCount > 0 && <Pill tone="worse">{p.overdueCount} overdue</Pill>}
                        {p.blockedCount > 0 && <Pill tone="worse">{p.blockedCount} blocked</Pill>}
                        {p.overdueCount === 0 && p.blockedCount === 0 && (
                          <span className="text-[12px] text-[#94a3b8]">—</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {group ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums"
                              style={{ color: DIRECTION_STYLE[group.direction].fg }}>
                          <DirectionIcon direction={group.direction} />
                          {group.movements.length}
                        </span>
                      ) : <span className="text-[12px] text-[#94a3b8]">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatTile({
  label, value, sub, tone,
}: {
  label: string
  value: number
  sub?: string
  tone?: Direction
}) {
  const fg = tone ? DIRECTION_STYLE[tone].fg : '#181818'
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] px-5 py-4">
      <p className="text-[11.5px] font-medium text-[#706E6B] m-0">{label}</p>
      <p className="text-[26px] font-bold tabular-nums leading-tight mt-1 m-0" style={{ color: fg }}>{value}</p>
      {sub && <p className="text-[11px] text-[#94a3b8] m-0 mt-0.5">{sub}</p>}
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#706E6B]"
      style={{ textAlign: align }}
    >
      {children}
    </th>
  )
}

function Pill({ children, tone }: { children: React.ReactNode; tone: Direction }) {
  const s = DIRECTION_STYLE[tone]
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {children}
    </span>
  )
}
