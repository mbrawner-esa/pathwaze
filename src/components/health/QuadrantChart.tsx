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
// NO NAMES ON THE PLOT. Printed beside every dot they collide — the chart is
// 14 points inside one screen and the names are long enough to cross it. Three
// placement schemes were tried (beside, above, stacked by collision level) and
// all three failed at this density. The name belongs to the dot you are asking
// about, so it appears on hover and on click, and nowhere else.
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

/**
 * The plot's own height.
 *
 * The whole quadrant has to land inside the window without scrolling, so this
 * is viewport-relative with a floor and a ceiling rather than a fixed 560px.
 * The subtrahend is the chrome above and below it on /health — page header,
 * control row, card padding, the two axis rows and the legend.
 */
const PLOT_H = 'clamp(260px, calc(100vh - 430px), 520px)'

/** Landscape, but close enough to square that the four cells read as equals. */
const PLOT_ASPECT = 1.3

const LABEL_W = 84

/**
 * Inset, in percent, between the axes and the nearest a dot may sit.
 *
 * Without it a project at zero on either axis is drawn centred on the border,
 * so half the mark falls outside the plot and lands on the axis labels. The
 * ticks use the same mapping, so the scale still reads true.
 */
const PAD = 4

/**
 * How close two marks may come, in mapped percent, before they are drawn as one
 * counted badge. A dot plus its blocked ring is about 26px; at the sizes this
 * chart runs that is roughly 4% of the width and 6% of the height.
 *
 * Merging rather than nudging is deliberate. A nudge big enough to separate two
 * marks is big enough to carry one across a divider, which would put a project
 * in a cell it is not in — the one thing this chart must never do.
 */
const MERGE_X = 4.5
const MERGE_Y = 6

const mapX = (v: number) => PAD + (v / 100) * (100 - 2 * PAD)

const DOT_FILL = { active: '#2F3E50', held: '#8095A8' } as const

/**
 * The four named states.
 *
 * Up is recent, right is further along, so the good corner is top-right the way
 * every reader already expects.
 */
/**
 * The four named states.
 *
 * Up is recent, right is further along, so the good corner is top-right the way
 * every reader already expects.
 *
 * The lower two sit just under the midline rather than in the bottom corners.
 * The corners are where the data goes — a parked portfolio piles into the
 * bottom-left — and a corner label there is a label with a dot on top of it.
 */
const CELLS = [
  { key: 'starting',  label: 'STARTING',  style: 'left-3 top-3' },
  { key: 'advancing', label: 'ADVANCING', style: 'right-3 top-3' },
  { key: 'dormant',   label: 'DORMANT',   style: 'left-3',  top: 'calc(50% + 9px)' },
  { key: 'stalled',   label: 'STALLED',   style: 'right-3', top: 'calc(50% + 9px)' },
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
}

/**
 * Strip the prefix every project shares.
 *
 * Nineteen names all starting "AdventHealth " is 13 characters of nothing on
 * every label. Computed from the data rather than hardcoded, so a second
 * customer does not quietly get the first one's prefix removed — which is why a
 * portfolio split across "AdventHealth" and "Adventist" keeps both in full.
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

/**
 * Where to draw the vertical divider, given the started projects' scores.
 *
 * A boundary has to fall in a GAP, not on a project. Taking the median value
 * itself put the median project exactly under the line, where it reads as
 * belonging to neither cell — so this lands halfway between the middle score
 * and the next one above it.
 *
 * Only projects that have started are passed in. Including the never-started
 * would drag the split to zero whenever most of the book is parked, which is
 * exactly when the comparison matters.
 */
function splitPoint(sorted: number[]): number {
  if (!sorted.length) return 0
  const lo = sorted[Math.floor((sorted.length - 1) / 2)]
  const hi = sorted.find(s => s > lo)
  return hi === undefined ? lo + 0.5 : (lo + hi) / 2
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
  const [hoverKey, setHoverKey] = useState<string | null>(null)

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
      median: splitPoint(scores),
    }
  }, [plotted])

  const points = useMemo(() => {
    // Cluster on RENDERED position, not on raw score: whether two marks collide
    // depends on where they are drawn, and the horizontal domain rescales with
    // the portfolio.
    const placed = plotted
      .map(r => ({
        row: r,
        x: mapX(Math.min(100, (r.advancement.score / domain) * 100)),
        y: mapX(r.advancement.recency),
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y)

    const groups: { x: number; y: number; rows: Plotted[] }[] = []
    for (const p of placed) {
      const hit = groups.find(g =>
        Math.abs(g.x - p.x) < MERGE_X && Math.abs(g.y - p.y) < MERGE_Y)
      if (hit) {
        hit.rows.push(p.row)
        // Re-centre on the members, so the badge sits where the group is.
        hit.x = (hit.x * (hit.rows.length - 1) + p.x) / hit.rows.length
        hit.y = (hit.y * (hit.rows.length - 1) + p.y) / hit.rows.length
      } else {
        groups.push({ x: p.x, y: p.y, rows: [p.row] })
      }
    }

    return groups.map<Point>(g => ({
      key: g.rows.length === 1 ? g.rows[0].projectId : `g:${g.rows.map(r => r.projectId).join(',')}`,
      x: g.x,
      y: g.y,
      rows: g.rows,
      blocked: g.rows.reduce((s, r) => s + blockedCount(r), 0),
      held: g.rows.every(r => r.held),
    }))
  }, [plotted, domain])

  const names = useMemo(() => shortNames(plotted), [plotted])

  if (plotted.length === 0) return null

  const open = points.find(p => p.key === openKey) ?? null
  const hover = points.find(p => p.key === hoverKey) ?? null
  const heldCount = plotted.filter(r => r.held).length
  const medianPct = mapX(Math.min(100, (median / domain) * 100))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ at: mapX(f * 100), label: Math.round(domain * f) }))

  return (
    // Sized to its content and centred. A quadrant stretched to a 1600px card
    // is mostly empty card — the plot's own aspect is what makes the four cells
    // read as equals.
    <section className="bg-white rounded-xl border border-[#e2e8f0] px-7 pt-5 pb-5 w-fit mx-auto max-w-full">
      <div className="flex flex-wrap gap-6 items-start">

        {/* ── plot column ── */}
        <div className="flex flex-col">

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
              <span className="absolute right-0 text-[10px] font-semibold text-[#55677A]" style={{ bottom: '96%' }}>
                Today
              </span>
              <span className="absolute right-0 text-[10px] font-semibold text-[#8A6519]" style={{ bottom: '47%' }}>
                {RECENT_DAYS} days
              </span>
              <span className="absolute right-0 text-[10px] font-semibold text-[#55677A]" style={{ bottom: 0 }}>
                Never
              </span>
            </div>

            <div className="relative bg-[#FAFBFC] border border-[#D6DEE7] box-border"
                 style={{ height: PLOT_H, aspectRatio: String(PLOT_ASPECT) }}>

              {/* Dividers. Horizontal is RECENT_DAYS, vertical is the median. */}
              <div className="absolute left-0 right-0 h-px bg-[#B9C6D2]" style={{ bottom: '50%' }} />
              <div className="absolute top-0 bottom-0 w-px bg-[#B9C6D2]" style={{ left: `${medianPct}%` }} />
              <span className="absolute text-[9.5px] text-[#9AA7B4] whitespace-nowrap"
                    style={{ left: `${medianPct}%`, bottom: 4, transform: 'translateX(5px)' }}>
                midpoint
              </span>

              {CELLS.map(c => (
                <span key={c.key}
                      className={'absolute text-[10px] font-bold tracking-[0.09em] text-[#55677A] ' + c.style}
                      style={'top' in c ? { top: c.top } : undefined}>
                  {c.label}
                </span>
              ))}

              {points.map(p => {
                const many = p.rows.length > 1
                const isOpen = p.key === openKey
                const lit = isOpen || p.key === hoverKey
                const common = {
                  onMouseEnter: () => setHoverKey(p.key),
                  onMouseLeave: () => setHoverKey(k => (k === p.key ? null : k)),
                  onFocus: () => setHoverKey(p.key),
                  onBlur: () => setHoverKey(k => (k === p.key ? null : k)),
                  onClick: () => setOpenKey(isOpen ? null : p.key),
                  style: {
                    left: `${p.x}%`,
                    bottom: `${p.y}%`,
                    transform: 'translate(-50%, 50%)',
                  } as const,
                }
                return many ? (
                  <button
                    key={p.key}
                    type="button"
                    {...common}
                    aria-label={`${groupLabel(p.rows)} at this point — open the list`}
                    className={'absolute inline-flex items-center justify-center w-[26px] h-[26px] rounded-full border-[1.5px] border-dashed bg-white text-[11px] font-bold text-[#3E3E3C] ' +
                      (lit ? 'border-[#C8963A]' : 'border-[#8095A8]')}
                  >
                    {p.rows.length}
                  </button>
                ) : (
                  <button
                    key={p.key}
                    type="button"
                    {...common}
                    aria-label={`${p.rows[0].name} — ${advancementSummary(p.rows[0].advancement)}${p.blocked ? ` ${p.blocked} blocked.` : ''}`}
                    className="absolute w-[15px] h-[15px] p-0 border-0 rounded-full cursor-pointer"
                    style={{
                      ...common.style,
                      background: p.held ? DOT_FILL.held : DOT_FILL.active,
                      boxShadow: p.blocked > 0
                        ? '0 0 0 2.5px #FFFFFF, 0 0 0 5.5px #B91C1C'
                        : lit ? '0 0 0 2.5px #FFFFFF, 0 0 0 5.5px #C8963A' : undefined,
                    }}
                  />
                )
              })}

              {/* The name, only for the dot being asked about. */}
              {hover && <Tip point={hover} names={names} />}
            </div>
          </div>

          {/* horizontal axis: ticks, then its name, both flat */}
          {/* Ticks sit on the same mapping as the dots, so the inset that keeps
              a zero-score mark inside the plot does not skew the scale. */}
          <div className="relative h-[14px]" style={{ marginLeft: LABEL_W + 8 }}>
            {ticks.map(t => (
              <span key={t.at}
                    className="absolute top-1.5 text-[9.5px] tabular-nums text-[#55677A]"
                    style={{ left: `${t.at}%`, transform: 'translateX(-50%)' }}>
                {t.label}%
              </span>
            ))}
          </div>
          <div className="flex items-baseline gap-2 pt-1" style={{ marginLeft: LABEL_W + 8 }}>
            <span className="text-[10.5px] font-bold tracking-[0.09em] text-[#55677A]">ADVANCEMENT →</span>
            <span className="text-[10.5px] text-[#55677A]">share of the plan&rsquo;s milestones complete</span>
          </div>
        </div>

        {/* ── detail rail ── */}
        <div className="w-[270px] shrink-0 bg-[#FAFBFC] border border-[#EDF1F5] rounded-[10px] p-4 box-border">
          {open === null ? (
            <p className="m-0 text-[12px] leading-[1.6] text-[#55677A]">
              Hover a dot for its name. Click one to see what it has finished, and when.
            </p>
          ) : open.rows.length > 1 ? (
            <ClusterDetail point={open} names={names} onClose={() => setOpenKey(null)} />
          ) : (
            <ProjectDetail row={open.rows[0]} onClose={() => setOpenKey(null)} />
          )}
        </div>
      </div>

      {/* legend — colour never travels without its label */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-[#F4F6F8]">
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
          Blocked
        </span>
        <span className="ml-auto text-[10.5px] text-[#55677A]">
          Both axes read from completion records · {heldCount} held, shown here only
        </span>
      </div>
    </section>
  )
}

/**
 * The hover card.
 *
 * Flips to whichever side has room, so a dot near an edge does not push its own
 * name outside the plot.
 */
function Tip({ point, names }: { point: Point; names: Map<string, string> }) {
  const many = point.rows.length > 1
  const r = point.rows[0]
  const label = many ? groupLabel(point.rows) : names.get(r.projectId) ?? r.name
  const low = point.y < 22
  const align = point.x > 70 ? 'translateX(-100%)' : point.x < 30 ? 'translateX(0)' : 'translateX(-50%)'

  return (
    <div
      className="absolute z-10 pointer-events-none rounded-md border border-[#D6DEE7] bg-white px-2.5 py-1.5 shadow-sm"
      style={{
        left: `${point.x}%`,
        [low ? 'bottom' : 'top']: `calc(${low ? point.y : 100 - point.y}% + 16px)`,
        transform: align,
        maxWidth: 230,
      }}
    >
      <p className="m-0 text-[11.5px] font-semibold text-[#181818] truncate">{label}</p>
      <p className="m-0 mt-0.5 text-[10.5px] text-[#55677A] whitespace-nowrap">
        {many
          ? lastAdvanceLabel(r.advancement)
          : `${r.advancement.score}% complete · ${lastAdvanceLabel(r.advancement).toLowerCase()}`}
        {point.blocked > 0 && <span className="text-[#B91C1C] font-semibold"> · {point.blocked} blocked</span>}
      </p>
    </div>
  )
}

/** What one project has finished, and when. */
function ProjectDetail({ row, onClose }: { row: Plotted; onClose: () => void }) {
  const blocked = blockedCount(row)
  const a = row.advancement
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="m-0 text-[13.5px] font-bold text-[#181818]">{row.name}</h3>
        <button type="button" onClick={onClose} aria-label="Clear selection"
                className="border-0 bg-transparent text-[#55677A] cursor-pointer p-0 px-0.5 shrink-0">
          <X size={13} />
        </button>
      </div>
      <p className="mt-0.5 mb-2.5 text-[11px] text-[#55677A]">{row.held ? 'On Hold' : row.stage}</p>

      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 bg-white border border-[#EDF1F5] rounded-[7px] px-2.5 py-1.5">
          <p className="m-0 text-[9.5px] font-bold tracking-[0.07em] text-[#55677A]">ADVANCEMENT</p>
          <p className="m-0 mt-0.5 text-[18px] font-bold tabular-nums text-[#181818]">{a.score}%</p>
        </div>
        <div className="flex-1 bg-white border border-[#EDF1F5] rounded-[7px] px-2.5 py-1.5">
          <p className="m-0 text-[9.5px] font-bold tracking-[0.07em] text-[#55677A]">LAST ADVANCED</p>
          <p className="m-0 mt-0.5 text-[18px] font-bold tabular-nums text-[#181818]">
            {a.daysSinceAdvance === null ? '—' : `${a.daysSinceAdvance}d`}
          </p>
        </div>
      </div>

      <p className="m-0 mb-2 text-[11.5px] leading-[1.5] text-[#3E3E3C]">{advancementSummary(a)}</p>

      <table className="w-full border-collapse mb-2">
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
        <p className="m-0 mb-2 px-2.5 py-1.5 rounded-md bg-[#FEF2F2] text-[#991B1B] text-[11.5px] leading-[1.45]">
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
                className="border-0 bg-transparent text-[#55677A] cursor-pointer p-0 px-0.5 shrink-0">
          <X size={13} />
        </button>
      </div>
      <p className="mt-0.5 mb-2 text-[10.5px] text-[#55677A]">
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
