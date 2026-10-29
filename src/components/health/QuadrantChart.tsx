'use client'

// The portfolio as four states, read from completion records.
//
// Both axes come from `workstream_milestones.completed_at` and nothing else —
// how much of the plan is finished, and how long ago the last piece landed. See
// advancement.ts for why activity_log cannot answer either question.
//
// FORM. A classifier, not a distribution. The four cells are named states and a
// project landing in one is the answer; points clustering inside a cell is the
// portfolio agreeing with itself, not the chart failing to spread.
//
// THE DIVIDERS CARRY THE MEANING, so neither is at an arbitrary halfway point.
// The horizontal one sits on RECENT_DAYS: above it, this project finished
// something in the last three weeks. The vertical one sits on the portfolio's
// own median, among projects that have started — "ahead of the rest of the
// book" is a real comparison, where "past 50% of an eighteen-major plan" would
// put every early-stage project in the same corner forever.
//
// COLOUR. Two fills and one ring. Position carries both scores, so colour only
// answers "live or parked", and the ring only "is something blocked". Blocked
// is a MARKER rather than a position on purpose: a project can be advancing and
// stuck at once, and moving it down an axis would hide half of that.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import {
  RECENT_DAYS, advancementSummary, lastAdvanceLabel, type Advancement,
} from '@/lib/advancement'
import type { PriorityRow } from '@/lib/portfolio-priority'

const PLOT_H = 560
const LABEL_W = 84

/** Raw-score tolerance for treating two projects as sharing a spot. */
const CLUSTER_BUCKET = 2

/** Proximity, in rendered percent, at which two labels are stacked apart. */
const LABEL_CLEAR_X = 16
const LABEL_CLEAR_Y = 6

const DOT_FILL = { active: '#2F3E50', held: '#8095A8' } as const

/**
 * The four named states.
 *
 * Up is recent, right is further along, so the good corner is top-right the way
 * every reader already expects.
 */
const CELLS = [
  { key: 'starting',  label: 'STARTING',  style: 'left-3 top-3' },
  { key: 'advancing', label: 'ADVANCING', style: 'right-3 top-3' },
  { key: 'dormant',   label: 'DORMANT',   style: 'left-3 bottom-3' },
  { key: 'stalled',   label: 'STALLED',   style: 'right-3 bottom-3' },
] as const

type Plotted = PriorityRow & { advancement: Advancement }

interface Point {
  key: string
  /** rendered position, 0-100 across the plot */
  x: number
  y: number
  rows: Plotted[]
  blocked: number
  held: boolean
  labelLevel: number
}

/**
 * Strip the prefix every project shares.
 *
 * Nineteen names all starting "AdventHealth " is 13 characters of nothing on
 * every label, and at this density the labels are most of the chart. Computed
 * from the data rather than hardcoded, so a second customer does not quietly
 * get the first one's prefix removed — which is why a portfolio split across
 * "AdventHealth" and "Adventist" keeps both in full.
 */
function shortNames(rows: Plotted[]): Map<string, string> {
  const split = rows.map(r => r.name.trim().split(/\s+/))
  let shared = 0
  if (split.length > 1) {
    const first = split[0]
    while (shared < first.length - 1
      && split.every(w => w.length > shared + 1 && w[shared] === first[shared])) shared++
  }
  return new Map(rows.map((r, i) => [r.projectId, split[i].slice(shared).join(' ')]))
}

function blockedCount(r: PriorityRow): number {
  return r.cardMilestones.filter(c => c.milestone.status === 'blocked').length
}

/** What a group of projects sharing one spot should be called. */
function groupLabel(rows: Plotted[]): string {
  const n = rows.length
  if (rows.every(r => r.advancement.doneCount === 0)) return `${n} not started`
  if (rows.every(r => r.held)) return `${n} held`
  return `${n} projects`
}

export function QuadrantChart({ rows }: { rows: PriorityRow[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  const plotted = useMemo(
    () => rows.filter((r): r is Plotted => !!r.advancement),
    [rows])

  /**
   * The horizontal scale.
   *
   * Domain runs to a rounded headroom above the furthest-along project rather
   * than to 100%. A development plan spans the whole lifecycle through
   * construction, so a portfolio still in design would otherwise sit squashed
   * against the left edge with four fifths of the chart permanently empty.
   */
  const { domain, median } = useMemo(() => {
    const started = plotted.filter(r => r.advancement.doneCount > 0)
    const scores = started.map(r => r.advancement.score).sort((a, b) => a - b)
    const max = scores.length ? scores[scores.length - 1] : 0
    return {
      domain: Math.max(10, Math.ceil((max * 1.3) / 5) * 5),
      // Median among projects that have STARTED. Including the never-started
      // would drag it to zero whenever most of the book is parked, which is
      // exactly when the comparison matters.
      median: scores.length ? scores[Math.floor((scores.length - 1) / 2)] : 0,
    }
  }, [plotted])

  const points = useMemo(() => {
    const buckets = new Map<string, Plotted[]>()
    for (const r of plotted) {
      const k = `${Math.round(r.advancement.score / CLUSTER_BUCKET)}:${Math.round(r.advancement.recency / CLUSTER_BUCKET)}`
      const b = buckets.get(k)
      if (b) b.push(r)
      else buckets.set(k, [r])
    }

    const out: Point[] = Array.from(buckets.values()).map(group => {
      const n = group.length
      const score = group.reduce((s, r) => s + r.advancement.score, 0) / n
      return {
        key: n === 1 ? group[0].projectId : `g:${group.map(r => r.projectId).join(',')}`,
        x: Math.min(100, (score / domain) * 100),
        y: group.reduce((s, r) => s + r.advancement.recency, 0) / n,
        rows: group,
        blocked: group.reduce((s, r) => s + blockedCount(r), 0),
        held: group.every(r => r.held),
        labelLevel: 0,
      }
    })

    // Stack labels that would otherwise overlap. Clustering only merges points
    // close enough to be the SAME spot; two points a tenth of the chart apart
    // still carry labels wide enough to collide.
    const placed: Point[] = []
    for (const p of [...out].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const near = placed.filter(q =>
        Math.abs(q.x - p.x) < LABEL_CLEAR_X && Math.abs(q.y - p.y) < LABEL_CLEAR_Y)
      const taken = new Set(near.map(q => q.labelLevel))
      while (taken.has(p.labelLevel)) p.labelLevel++
      placed.push(p)
    }
    return out
  }, [plotted, domain])

  const names = useMemo(() => shortNames(plotted), [plotted])

  if (plotted.length === 0) return null

  const open = points.find(p => p.key === openKey) ?? null
  const heldCount = plotted.filter(r => r.held).length
  const medianPct = Math.min(100, (median / domain) * 100)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(domain * f))

  return (
    <section className="bg-white rounded-xl border border-[#e2e8f0] px-7 pt-6 pb-6">
      <div className="flex flex-wrap gap-7 items-start">

        {/* ── plot column ── */}
        <div className="flex flex-col min-w-0 flex-1">

          {/* Both axes are named flat. A rotated label costs a whole column of
              width and makes the one piece of orienting text the hardest thing
              on the page to read. */}
          <div className="flex items-baseline gap-2 mb-2" style={{ paddingLeft: LABEL_W + 8 }}>
            <span className="text-[10.5px] font-bold tracking-[0.09em] text-[#55677A]">↑ LAST ADVANCED</span>
            <span className="text-[10.5px] text-[#55677A]">when a milestone was last completed</span>
          </div>

          <div className="flex gap-2">
            {/* recency reference points, one line each */}
            <div className="relative shrink-0" style={{ width: LABEL_W, height: PLOT_H }}>
              <span className="absolute right-0 text-[10px] font-semibold text-[#55677A]" style={{ bottom: '97%' }}>
                Today
              </span>
              <span className="absolute right-0 text-[10px] font-semibold text-[#8A6519]" style={{ bottom: '48%' }}>
                {RECENT_DAYS} days
              </span>
              <span className="absolute right-0 text-[10px] font-semibold text-[#55677A]" style={{ bottom: '1%' }}>
                Never
              </span>
            </div>

            <div className="relative flex-1 min-w-[420px] bg-[#FAFBFC] border border-[#D6DEE7] box-border"
                 style={{ height: PLOT_H }}>

              {/* Dividers. Horizontal is RECENT_DAYS, vertical is the median. */}
              <div className="absolute left-0 right-0 h-px bg-[#B9C6D2]" style={{ bottom: '50%' }} />
              <div className="absolute top-0 bottom-0 w-px bg-[#B9C6D2]" style={{ left: `${medianPct}%` }} />
              <span className="absolute text-[9.5px] text-[#9AA7B4] whitespace-nowrap"
                    style={{ left: `${medianPct}%`, bottom: 4, transform: 'translateX(4px)' }}>
                portfolio median
              </span>

              {CELLS.map(c => (
                <span key={c.key}
                      className={'absolute text-[10px] font-bold tracking-[0.09em] text-[#55677A] ' + c.style}>
                  {c.label}
                </span>
              ))}

              {points.map(p => {
                const many = p.rows.length > 1
                // A group is named by what it IS — three ACTIVE projects were
                // once labelled "3 parked" by a hardcoded string here.
                const label = many ? groupLabel(p.rows) : names.get(p.rows[0].projectId) ?? p.rows[0].name
                const isOpen = p.key === openKey
                return (
                  <div key={p.key}>
                    <span className="absolute flex items-baseline gap-1 whitespace-nowrap pointer-events-none"
                          style={{
                            left: `${p.x}%`,
                            bottom: `calc(${p.y}% + ${14 + p.labelLevel * 15}px)`,
                            transform: 'translateX(-50%)',
                          }}
                          title={many ? undefined : p.rows[0].name}>
                      <span className="inline-block max-w-[150px] overflow-hidden text-ellipsis text-[11.5px] font-semibold text-[#181818]">
                        {label}
                      </span>
                      {p.blocked > 0 && <span className="text-[11.5px] font-bold text-[#B91C1C]">{p.blocked}</span>}
                    </span>

                    {many ? (
                      <button
                        type="button"
                        onClick={() => setOpenKey(isOpen ? null : p.key)}
                        aria-label={`${p.rows.length} projects at this point — open the list`}
                        className="absolute inline-flex items-center justify-center w-[26px] h-[26px] rounded-full border-[1.5px] border-dashed border-[#8095A8] bg-white text-[11px] font-bold text-[#3E3E3C] hover:bg-[#F7F9FA]"
                        style={{ left: `${p.x}%`, bottom: `${p.y}%`, transform: 'translate(-50%, 50%)' }}
                      >
                        {p.rows.length}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenKey(isOpen ? null : p.key)}
                        aria-label={`${p.rows[0].name} — ${advancementSummary(p.rows[0].advancement)}${p.blocked ? ` ${p.blocked} blocked.` : ''}`}
                        className="absolute w-[15px] h-[15px] p-0 border-0 rounded-full cursor-pointer"
                        style={{
                          left: `${p.x}%`,
                          bottom: `${p.y}%`,
                          transform: 'translate(-50%, 50%)',
                          background: p.held ? DOT_FILL.held : DOT_FILL.active,
                          boxShadow: p.blocked > 0
                            ? '0 0 0 2.5px #FFFFFF, 0 0 0 5.5px #B91C1C'
                            : isOpen ? '0 0 0 2.5px #FFFFFF, 0 0 0 5.5px #C8963A' : undefined,
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* horizontal axis: ticks, then its name, both flat */}
          <div className="flex justify-between pt-1.5" style={{ marginLeft: LABEL_W + 8 }}>
            {ticks.map((t, i) => (
              <span key={i} className="text-[9.5px] tabular-nums text-[#55677A]">{t}%</span>
            ))}
          </div>
          <div className="flex items-baseline gap-2 pt-1" style={{ marginLeft: LABEL_W + 8 }}>
            <span className="text-[10.5px] font-bold tracking-[0.09em] text-[#55677A]">ADVANCEMENT →</span>
            <span className="text-[10.5px] text-[#55677A]">share of the plan&rsquo;s milestones complete</span>
          </div>
        </div>

        {/* ── detail rail ── */}
        <div className="w-[286px] shrink-0 bg-[#FAFBFC] border border-[#EDF1F5] rounded-[10px] p-[17px] box-border">
          {open === null ? (
            <p className="m-0 text-[12px] leading-[1.6] text-[#55677A]">
              Select a project to see what it has finished, and when.
            </p>
          ) : open.rows.length > 1 ? (
            <ClusterDetail point={open} names={names} onClose={() => setOpenKey(null)} />
          ) : (
            <ProjectDetail row={open.rows[0]} onClose={() => setOpenKey(null)} />
          )}
        </div>
      </div>

      {/* legend — colour never travels without its label */}
      <div className="flex flex-wrap items-center gap-[18px] mt-5 pt-3.5 border-t border-[#F4F6F8]">
        <span className="inline-flex items-center gap-[7px] text-[11px] text-[#3E3E3C]">
          <i className="block w-[11px] h-[11px] rounded-full" style={{ background: DOT_FILL.active }} />
          Active
        </span>
        <span className="inline-flex items-center gap-[7px] text-[11px] text-[#3E3E3C]">
          <i className="block w-[11px] h-[11px] rounded-full" style={{ background: DOT_FILL.held }} />
          Held
        </span>
        <span className="inline-flex items-center gap-[11px] text-[11px] text-[#3E3E3C]">
          <i className="block w-[11px] h-[11px] rounded-full"
             style={{ background: DOT_FILL.active, boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 3.5px #B91C1C' }} />
          Blocked milestones, with the count
        </span>
        <span className="ml-auto text-[10.5px] text-[#55677A]">
          Both axes read from completion records · {heldCount} held, shown here only
        </span>
      </div>
    </section>
  )
}

/** What one project has finished, and when. */
function ProjectDetail({ row, onClose }: { row: Plotted; onClose: () => void }) {
  const blocked = blockedCount(row)
  const a = row.advancement
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="m-0 text-[14px] font-bold text-[#181818]">{row.name}</h3>
        <button type="button" onClick={onClose} aria-label="Clear selection"
                className="border-0 bg-transparent text-[#55677A] cursor-pointer p-0 px-0.5">
          <X size={13} />
        </button>
      </div>
      <p className="mt-0.5 mb-3 text-[11px] text-[#55677A]">{row.held ? 'On Hold' : row.stage}</p>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-white border border-[#EDF1F5] rounded-[7px] px-2.5 py-2">
          <p className="m-0 text-[9.5px] font-bold tracking-[0.07em] text-[#55677A]">ADVANCEMENT</p>
          <p className="m-0 mt-0.5 text-[19px] font-bold tabular-nums text-[#181818]">{a.score}%</p>
        </div>
        <div className="flex-1 bg-white border border-[#EDF1F5] rounded-[7px] px-2.5 py-2">
          <p className="m-0 text-[9.5px] font-bold tracking-[0.07em] text-[#55677A]">LAST ADVANCED</p>
          <p className="m-0 mt-0.5 text-[19px] font-bold tabular-nums text-[#181818]">
            {a.daysSinceAdvance === null ? '—' : `${a.daysSinceAdvance}d`}
          </p>
        </div>
      </div>

      <p className="m-0 mb-2.5 text-[11.5px] leading-[1.5] text-[#3E3E3C]">{advancementSummary(a)}</p>

      <table className="w-full border-collapse mb-2.5">
        <tbody>
          <tr>
            <td className="py-[3px] text-[11.5px] text-[#3E3E3C]">Milestones complete</td>
            <td className="py-[3px] text-[11.5px] tabular-nums text-[#55677A] text-right w-[60px]">
              {a.doneCount} / {a.totalCount}
            </td>
          </tr>
          <tr>
            <td className="py-[3px] text-[11.5px] text-[#3E3E3C]">Blocked</td>
            <td className="py-[3px] text-[11.5px] tabular-nums text-right w-[60px]"
                style={{ color: blocked > 0 ? '#b91c1c' : '#55677A' }}>
              {blocked}
            </td>
          </tr>
        </tbody>
      </table>

      {blocked > 0 && (
        <p className="m-0 mb-2.5 px-2.5 py-2 rounded-md bg-[#FEF2F2] text-[#991B1B] text-[11.5px] leading-[1.5]">
          {blocked} blocked {blocked === 1 ? 'milestone' : 'milestones'} — effort going in, nothing coming out.
        </p>
      )}

      <Link href={`/projects/${row.projectId}`} className="inline-block text-[11.5px] font-semibold text-[#2F3E50] hover:text-[#C8963A]">
        Open project →
      </Link>
    </div>
  )
}

/** The projects sharing one spot, named rather than counted. */
function ClusterDetail({
  point, names, onClose,
}: {
  point: Point
  names: Map<string, string>
  onClose: () => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="m-0 text-[12.5px] font-bold text-[#181818]">{groupLabel(point.rows)}</h3>
        <button type="button" onClick={onClose} aria-label="Close the list"
                className="border-0 bg-transparent text-[#55677A] cursor-pointer p-0 px-0.5">
          <X size={13} />
        </button>
      </div>
      <p className="mt-0.5 mb-2.5 text-[10.5px] text-[#55677A]">
        {lastAdvanceLabel(point.rows[0].advancement)}
      </p>
      {point.rows.map(r => (
        <Link key={r.projectId} href={`/projects/${r.projectId}`}
              className="block mb-1 text-[11.5px] text-[#3E3E3C] hover:text-[#C8963A]">
          {names.get(r.projectId) ?? r.name}
        </Link>
      ))}
    </div>
  )
}
