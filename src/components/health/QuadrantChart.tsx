'use client'

// The portfolio as four states, read from completion records.
//
// This is a VISUALIZATION, not a control surface: something to put on a screen
// in front of stakeholders and point at. That decides most of what follows —
// the plot is the largest thing on the page, every mark carries its name, and
// nothing permanent sits beside it competing for the eye.
//
// Both axes come from `workstream_milestones.completed_at` and nothing else —
// how much of the plan is finished, and how long ago the last piece landed. See
// advancement.ts for why activity_log cannot answer either question.
//
// THE DIVIDERS CARRY THE MEANING, so neither is at an arbitrary halfway point.
// The horizontal one sits on RECENT_DAYS: above it, this project finished
// something in the last three weeks. The vertical one sits in the gap above the
// portfolio's median, among projects that have started — "ahead of the rest of
// the book" is a real comparison, where "past 50% of an eighteen-major plan"
// would put every early-stage project in the same corner forever.
//
// LABELS ARE PLACED, NOT OFFSET. An earlier pass printed every name at a fixed
// spot above its dot; they collided, so a pass after that removed names
// entirely — which made the chart useless for the one job it has, since nobody
// can align on a dot they cannot identify. Names are back, and a mark now tries
// eight positions around itself and takes the first that hits nothing. See
// placeLabels.
//
// COLOUR. Two fills and one ring. Position carries both scores, so colour only
// answers "live or parked", and the ring only "is something blocked". Blocked
// is a MARKER rather than a position on purpose: a project can be advancing and
// stuck at once, and moving it down an axis would hide half of that.

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import {
  RECENT_DAYS, advancementSummary, lastAdvanceLabel, type Advancement,
} from '@/lib/advancement'
import type { PriorityRow } from '@/lib/portfolio-priority'

/**
 * The plot fills the page's width and takes what height the window allows.
 *
 * Landscape rather than square, and deliberately so: the horizontal axis is
 * where this portfolio actually spreads, and width is what separates marks that
 * would otherwise have to be merged into a counted badge.
 */
const PLOT_H = 'clamp(320px, calc(100vh - 430px), 580px)'

const AXIS_W = 78

/**
 * Inset, in percent, between the axes and the nearest a mark may sit.
 *
 * Without it a project at zero on either axis is drawn centred on the border,
 * so half the mark falls outside the plot and lands on the axis labels. The
 * ticks use the same mapping, so the scale still reads true.
 */
const PAD = 5

/**
 * How close two marks may come before they are drawn as one counted badge.
 *
 * Derived from the plot's measured pixel size rather than fixed in percent,
 * because whether two marks collide is a question about pixels: the same 2.6%
 * gap hides one project on a 600px plot and separates two cleanly on a 1400px
 * one. Widening the chart therefore un-merges marks on its own.
 *
 * Merging rather than nudging is deliberate. A nudge big enough to separate two
 * marks is big enough to carry one across a divider, which would put a project
 * in a cell it is not in — the one thing this chart must never do.
 */
const MERGE_GAP = 26
const MERGE_FALLBACK = 5

const DOT = 18
const BADGE = 34

const DOT_FILL = { active: '#2F3E50', held: '#8095A8' } as const

const map = (v: number) => PAD + (v / 100) * (100 - 2 * PAD)

/**
 * The four named states.
 *
 * Up is recent, right is further along, so the good corner is top-right the way
 * every reader already expects.
 */
/**
 * The lower two sit just under the midline rather than in the bottom corners.
 * The corners are where the data goes — a parked portfolio piles into the
 * bottom-left — and a corner label there is a label with a mark on top of it.
 */
const CELLS = [
  { key: 'starting',  label: 'STARTING',  x: 'left',  top: 11 },
  { key: 'advancing', label: 'ADVANCING', x: 'right', top: 11 },
  { key: 'dormant',   label: 'DORMANT',   x: 'left',  top: 'calc(50% + 10px)' },
  { key: 'stalled',   label: 'STALLED',   x: 'right', top: 'calc(50% + 10px)' },
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
  label: string
  /** half-width of the mark in px, for label placement and hit tests */
  r: number
}

interface Box { left: number; top: number; w: number; h: number }

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.w && a.left + a.w > b.left
    && a.top < b.top + b.h && a.top + a.h > b.top
}

/**
 * Where each mark's name goes.
 *
 * Eight candidate positions per mark, tried in order of how well they read —
 * beside first, then above and below, then the diagonals. A candidate is taken
 * if it stays inside the plot and collides with no label already placed and no
 * mark at all. Marks are placed highest-first so the eye-catching ones get the
 * cleanest spots.
 *
 * Widths are estimated from the character count rather than measured: measuring
 * means rendering twice, and at 11.5px semibold the estimate is within a few
 * pixels — enough for a collision test whose job is to avoid overlap, not to
 * pack tightly.
 */
function placeLabels(points: Point[], w: number, h: number): Map<string, Box & { align: 'left' | 'right' | 'center' }> {
  const out = new Map<string, Box & { align: 'left' | 'right' | 'center' }>()
  if (!w || !h) return out

  const LH = 15
  const marks: Box[] = points.map(p => ({
    left: (p.x / 100) * w - p.r, top: (1 - p.y / 100) * h - p.r, w: p.r * 2, h: p.r * 2,
  }))

  const ordered = [...points].sort((a, b) => b.y - a.y || a.x - b.x)

  for (const p of ordered) {
    // The " · N" blocked suffix is drawn but is not part of p.label.
    const lw = p.label.length * 6.2 + 2 + (p.blocked > 0 && p.rows.length === 1 ? 22 : 0)
    const cx = (p.x / 100) * w
    const cy = (1 - p.y / 100) * h
    const gap = p.r + 7

    const candidates: (Box & { align: 'left' | 'right' | 'center' })[] = [
      { left: cx + gap,          top: cy - LH / 2,  w: lw, h: LH, align: 'left' },
      { left: cx - gap - lw,     top: cy - LH / 2,  w: lw, h: LH, align: 'right' },
      { left: cx - lw / 2,       top: cy - gap - LH, w: lw, h: LH, align: 'center' },
      { left: cx - lw / 2,       top: cy + gap,      w: lw, h: LH, align: 'center' },
      { left: cx + gap * 0.7,    top: cy - gap - LH, w: lw, h: LH, align: 'left' },
      { left: cx - gap * 0.7 - lw, top: cy - gap - LH, w: lw, h: LH, align: 'right' },
      { left: cx + gap * 0.7,    top: cy + gap,      w: lw, h: LH, align: 'left' },
      { left: cx - gap * 0.7 - lw, top: cy + gap,    w: lw, h: LH, align: 'right' },
    ]

    const placed = Array.from(out.values())
    const fit = candidates.find(c =>
      c.left >= 2 && c.top >= 2 && c.left + c.w <= w - 2 && c.top + c.h <= h - 2
      && !placed.some(q => overlaps(c, q))
      && !marks.some(m => overlaps(c, m)))

    out.set(p.key, fit ?? candidates[0])
  }
  return out
}

/**
 * Strip the prefix every project shares.
 *
 * Nineteen names all starting "AdventHealth " is 13 characters of nothing on
 * every label, and on a labelled chart that is most of the ink. Computed from
 * the data rather than hardcoded, so a second customer does not quietly get the
 * first one's prefix removed — which is why a portfolio split across
 * "AdventHealth" and "Adventist" keeps both in full.
 */
function shortNames(rows: Plotted[]): Map<string, string> {
  const split = new Map(rows.map(r => [r.projectId, r.name.trim().split(/\s+/)]))

  // The common prefix only has to be common, not universal. Requiring EVERY
  // name to share it meant one "Adventist" among eleven "AdventHealth" left the
  // customer name on all fourteen labels, which is most of the ink on the
  // chart. Names that do not carry the prefix keep theirs in full, so nothing
  // becomes ambiguous.
  const counts = new Map<string, number>()
  for (const w of Array.from(split.values())) {
    if (w.length > 1) counts.set(w[0], (counts.get(w[0]) ?? 0) + 1)
  }
  const [lead, n] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  const strip = rows.length > 2 && n / rows.length >= 0.6 ? lead : null

  return new Map(rows.map(r => {
    const w = split.get(r.projectId)!
    return [r.projectId, strip && w.length > 1 && w[0] === strip ? w.slice(1).join(' ') : w.join(' ')]
  }))
}

/** Which of the four cells a mark sits in, for the card it opens. */
function cellFor(x: number, y: number, split: number): string {
  if (y >= 50) return x >= split ? 'ADVANCING' : 'STARTING'
  return x >= split ? 'STALLED' : 'DORMANT'
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

export function QuadrantChart({ rows }: { rows: PriorityRow[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  // Label placement is done in pixels, so it needs the plot's real size. The
  // plot is viewport-sized, so that changes with the window.
  useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setBox({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const plotted = useMemo(
    () => rows.filter((r): r is Plotted => !!r.advancement),
    [rows])

  const names = useMemo(() => shortNames(plotted), [plotted])

  /**
   * The horizontal scale.
   *
   * Domain runs to a rounded headroom above the furthest-along project rather
   * than to 100%. A development plan spans the whole lifecycle through
   * construction, so a portfolio still in design would otherwise sit squashed
   * against the left edge with four fifths of the chart permanently empty.
   */
  const { domain, median } = useMemo(() => {
    const scores = plotted.filter(r => r.advancement.doneCount > 0)
      .map(r => r.advancement.score).sort((a, b) => a - b)
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
        x: map(Math.min(100, (r.advancement.score / domain) * 100)),
        y: map(r.advancement.recency),
      }))
      .sort((a, b) => a.x - b.x || a.y - b.y)

    const mx = box.w ? (MERGE_GAP / box.w) * 100 : MERGE_FALLBACK
    const my = box.h ? (MERGE_GAP / box.h) * 100 : MERGE_FALLBACK

    const groups: { x: number; y: number; rows: Plotted[] }[] = []
    for (const p of placed) {
      const hit = groups.find(g =>
        Math.abs(g.x - p.x) < mx && Math.abs(g.y - p.y) < my)
      if (hit) {
        hit.rows.push(p.row)
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
      label: g.rows.length === 1
        ? names.get(g.rows[0].projectId) ?? g.rows[0].name
        : groupLabel(g.rows),
      r: (g.rows.length === 1 ? DOT : BADGE) / 2,
    }))
  }, [plotted, domain, names, box])

  const labels = useMemo(() => placeLabels(points, box.w, box.h), [points, box])

  if (plotted.length === 0) return null

  const open = points.find(p => p.key === openKey) ?? null
  const heldCount = plotted.filter(r => r.held).length
  const medianPct = map(Math.min(100, (median / domain) * 100))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ at: map(f * 100), label: Math.round(domain * f) }))

  return (
    <section className="bg-white rounded-xl border border-[#e2e8f0] px-8 pt-6 pb-5 w-full">

      {/* vertical axis, named flat — a rotated label costs a column of width and
          is the hardest text on the page to read */}
      <div className="flex items-baseline gap-2 mb-2.5" style={{ paddingLeft: AXIS_W }}>
        <span className="text-[11px] font-bold tracking-[0.1em] text-[#3E3E3C]">↑ LAST ADVANCED</span>
        <span className="text-[11px] text-[#55677A]">when a milestone was last completed</span>
      </div>

      <div className="flex gap-2">
        {/* recency reference points */}
        <div className="relative shrink-0" style={{ width: AXIS_W - 8, height: PLOT_H }}>
          {/* `top` grows downward and recency does not: 100 is today and belongs
              at the TOP, which is the same inversion the marks apply. */}
          <span className="absolute right-0 -translate-y-1/2 text-[10.5px] font-semibold text-[#55677A]" style={{ top: `${100 - map(100)}%` }}>
            Today
          </span>
          <span className="absolute right-0 -translate-y-1/2 text-[10.5px] font-semibold text-[#8A6519]" style={{ top: '50%' }}>
            {RECENT_DAYS} days
          </span>
          <span className="absolute right-0 -translate-y-1/2 text-[10.5px] font-semibold text-[#55677A]" style={{ top: `${100 - map(0)}%` }}>
            Never
          </span>
        </div>

        <div ref={plotRef}
             className="relative flex-1 min-w-0 bg-white border border-[#D6DEE7] box-border"
             style={{ height: PLOT_H }}>

          {/* The good corner, marked with the lightest possible wash. Anything
              stronger and the fill competes with the marks it exists to frame. */}
          <div className="absolute bg-[#F6FAF7]" style={{ left: `${medianPct}%`, right: 0, top: 0, height: '50%' }} />

          {/* Dividers. Horizontal is RECENT_DAYS, vertical is the split point. */}
          <div className="absolute left-0 right-0 h-px bg-[#C6D0DA]" style={{ top: '50%' }} />
          <div className="absolute top-0 bottom-0 w-px bg-[#C6D0DA]" style={{ left: `${medianPct}%` }} />

          {CELLS.map(c => (
            <span key={c.key}
                  className="absolute text-[10.5px] font-bold tracking-[0.11em] text-[#8A97A5]"
                  style={{ [c.x]: 12, top: c.top }}>
              {c.label}
            </span>
          ))}

          {/* ── the marks ── */}
          {points.map(p => {
            const many = p.rows.length > 1
            const isOpen = p.key === openKey
            const lit = isOpen || p.key === hoverKey
            const handlers = {
              onMouseEnter: () => setHoverKey(p.key),
              onMouseLeave: () => setHoverKey(k => (k === p.key ? null : k)),
              onFocus: () => setHoverKey(p.key),
              onBlur: () => setHoverKey(k => (k === p.key ? null : k)),
              onClick: () => setOpenKey(isOpen ? null : p.key),
            }
            const place = {
              left: `${p.x}%`,
              top: `${100 - p.y}%`,
              transform: 'translate(-50%, -50%)',
            }
            return many ? (
              <button key={p.key} type="button" {...handlers}
                      aria-label={`${p.label} at this point — open the list`}
                      className={'absolute inline-flex items-center justify-center rounded-full border-2 border-dashed bg-white text-[12px] font-bold text-[#3E3E3C] transition-colors ' +
                        (lit ? 'border-[#C8963A]' : 'border-[#8095A8]')}
                      style={{ ...place, width: BADGE, height: BADGE }}>
                {p.rows.length}
              </button>
            ) : (
              <button key={p.key} type="button" {...handlers}
                      aria-label={`${p.rows[0].name} — ${advancementSummary(p.rows[0].advancement)}${p.blocked ? ` ${p.blocked} blocked.` : ''}`}
                      className="absolute p-0 border-0 rounded-full cursor-pointer transition-transform hover:scale-110"
                      style={{
                        ...place,
                        width: DOT,
                        height: DOT,
                        background: p.held ? DOT_FILL.held : DOT_FILL.active,
                        boxShadow: p.blocked > 0
                          ? '0 0 0 3px #FFFFFF, 0 0 0 6px #B91C1C'
                          : lit ? '0 0 0 3px #FFFFFF, 0 0 0 6px #C8963A' : undefined,
                      }} />
            )
          })}

          {/* ── the names ── */}
          {points.map(p => {
            const l = labels.get(p.key)
            if (!l) return null
            return (
              <span key={`l:${p.key}`}
                    className="absolute pointer-events-none text-[11.5px] font-semibold text-[#181818] whitespace-nowrap leading-[15px]"
                    style={{
                      left: l.left,
                      top: l.top,
                      width: l.w,
                      textAlign: l.align,
                    }}>
                {p.label}
                {/* Only on a single project. "2 projects 2" is not a sentence —
                    a group's blocked count lives in the card it opens. The
                    separator keeps the count from reading as part of the name. */}
                {p.blocked > 0 && p.rows.length === 1 && (
                  <>
                    <span className="text-[#C6D0DA]"> · </span>
                    <span className="text-[#B91C1C] font-bold">{p.blocked}</span>
                  </>
                )}
              </span>
            )
          })}

          {/* Detail opens over the plot, anchored to its mark — a panel parked
              beside the chart would reserve half the card to show nothing. */}
          {open && (
            <Detail point={open}
                    cell={cellFor(open.x, open.y, medianPct)}
                    onClose={() => setOpenKey(null)} />
          )}
        </div>
      </div>

      {/* horizontal axis */}
      <div className="relative h-[15px]" style={{ marginLeft: AXIS_W }}>
        {ticks.map(t => (
          <span key={t.at}
                className="absolute top-1.5 text-[10px] tabular-nums text-[#55677A]"
                style={{ left: `${t.at}%`, transform: 'translateX(-50%)' }}>
            {t.label}%
          </span>
        ))}
      </div>
      <div className="flex items-baseline gap-2 pt-2" style={{ marginLeft: AXIS_W }}>
        <span className="text-[11px] font-bold tracking-[0.1em] text-[#3E3E3C]">ADVANCEMENT →</span>
        <span className="text-[11px] text-[#55677A]">share of the plan&rsquo;s milestones complete</span>
      </div>

      {/* legend — colour never travels without its label */}
      <div className="flex flex-wrap items-center gap-5 mt-4 pt-3 border-t border-[#F1F5F9]"
           style={{ marginLeft: AXIS_W }}>
        <span className="inline-flex items-center gap-2 text-[11px] text-[#3E3E3C]">
          <i className="block w-3 h-3 rounded-full" style={{ background: DOT_FILL.active }} />
          Active
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] text-[#3E3E3C]">
          <i className="block w-3 h-3 rounded-full" style={{ background: DOT_FILL.held }} />
          Held
        </span>
        <span className="inline-flex items-center gap-3 text-[11px] text-[#3E3E3C]">
          <i className="block w-3 h-3 rounded-full"
             style={{ background: DOT_FILL.active, boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 4px #B91C1C' }} />
          Blocked, with the count
        </span>
        <span className="ml-auto text-[10.5px] text-[#55677A]">
          Read from completion records · {heldCount} held, shown here only
        </span>
      </div>
    </section>
  )
}

/**
 * The card that opens on a mark.
 *
 * Anchored to its own mark and flipped to whichever side has room, so it never
 * covers the thing you just clicked and never leaves the plot.
 */
function Detail({ point, cell, onClose }: { point: Point; cell: string; onClose: () => void }) {
  const many = point.rows.length > 1
  const right = point.x > 55
  const low = point.y < 45

  return (
    <div
      className="absolute z-20 rounded-lg border border-[#D6DEE7] bg-white shadow-lg px-4 py-3.5"
      style={{
        left: `${point.x}%`,
        top: `${100 - point.y}%`,
        width: many ? 310 : 274,
        maxHeight: 'calc(100% - 16px)',
        overflowY: 'auto',
        transform: `translate(${right ? 'calc(-100% - 18px)' : '18px'}, ${low ? '-100%' : '0'})`,
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close"
              className="absolute right-2 top-2 border-0 bg-transparent text-[#55677A] cursor-pointer p-0.5">
        <X size={13} />
      </button>
      <p className="m-0 mb-2 text-[9px] font-bold tracking-[0.11em] text-[#8A97A5]">{cell}</p>
      {many ? <ClusterBody point={point} /> : <ProjectBody row={point.rows[0]} />}
    </div>
  )
}

/** One line of the breakdown. */
function Line({ label, value, alarm = false }: { label: string; value: string; alarm?: boolean }) {
  return (
    <tr>
      <td className="py-[3px] text-[11px] text-[#55677A]">{label}</td>
      <td className="py-[3px] text-[11px] font-semibold tabular-nums text-right"
          style={{ color: alarm ? '#b91c1c' : '#181818' }}>
        {value}
      </td>
    </tr>
  )
}

/**
 * Every number behind the two axes, for one project.
 *
 * Both scores are derived, so showing only the derived value invites the
 * argument rather than settling it — the counts they came from are what make
 * the position defensible in a room.
 */
function Breakdown({ row }: { row: Plotted }) {
  const a = row.advancement
  const blocked = blockedCount(row)
  return (
    <table className="w-full border-collapse">
      <tbody>
        <Line label="Milestones complete" value={`${a.doneCount} of ${a.totalCount}`} />
        <Line label="Advancement" value={`${a.score}%`} />
        <Line label="Last advanced"
              value={a.daysSinceAdvance === null ? 'Never' : `${a.daysSinceAdvance}d ago`} />
        <Line label="Blocked" value={String(blocked)} alarm={blocked > 0} />
      </tbody>
    </table>
  )
}

function ProjectBody({ row }: { row: Plotted }) {
  const blocked = blockedCount(row)
  const a = row.advancement
  return (
    <div>
      <h3 className="m-0 pr-5 text-[13px] font-bold text-[#181818] leading-snug">{row.name}</h3>
      <p className="mt-0.5 mb-2.5 text-[10.5px] text-[#55677A]">{row.held ? 'On Hold' : row.stage}</p>

      <div className="flex gap-2 mb-2.5">
        <div className="flex-1 bg-[#FAFBFC] border border-[#EDF1F5] rounded-md px-2 py-1.5">
          <p className="m-0 text-[9px] font-bold tracking-[0.07em] text-[#55677A]">ADVANCEMENT</p>
          <p className="m-0 mt-0.5 text-[17px] font-bold tabular-nums text-[#181818]">{a.score}%</p>
        </div>
        <div className="flex-1 bg-[#FAFBFC] border border-[#EDF1F5] rounded-md px-2 py-1.5">
          <p className="m-0 text-[9px] font-bold tracking-[0.07em] text-[#55677A]">LAST ADVANCED</p>
          <p className="m-0 mt-0.5 text-[17px] font-bold tabular-nums text-[#181818]">
            {a.daysSinceAdvance === null ? '—' : `${a.daysSinceAdvance}d`}
          </p>
        </div>
      </div>

      <div className="mb-2 pb-2 border-b border-[#F1F5F9]">
        <Breakdown row={row} />
      </div>

      {blocked > 0 && (
        <p className="m-0 mb-2 px-2 py-1.5 rounded bg-[#FEF2F2] text-[#991B1B] text-[11px] leading-[1.45]">
          {blocked} blocked {blocked === 1 ? 'milestone' : 'milestones'} — effort going in, nothing coming out.
        </p>
      )}

      <Link href={`/projects/${row.projectId}`}
            className="inline-block text-[11px] font-semibold text-[#2F3E50] hover:text-[#C8963A]">
        Open project →
      </Link>
    </div>
  )
}

/**
 * A group's card.
 *
 * Every member gets its full breakdown, not just its name. The marks are merged
 * because they overlap on screen, which says nothing about the projects being
 * interchangeable — clicking the badge is how you tell them apart, so a list of
 * names alone would leave you no better off than the badge did.
 */
function ClusterBody({ point }: { point: Point }) {
  return (
    <div>
      <h3 className="m-0 pr-5 text-[13px] font-bold text-[#181818]">{point.label}</h3>
      <p className="mt-0.5 mb-2.5 text-[10.5px] text-[#55677A]">
        {lastAdvanceLabel(point.rows[0].advancement)} · same position on both axes
      </p>
      {point.rows.map((r, i) => (
        <div key={r.projectId}
             className={i > 0 ? 'mt-2.5 pt-2.5 border-t border-[#F1F5F9]' : ''}>
          <Link href={`/projects/${r.projectId}`}
                className="block text-[12px] font-semibold text-[#2F3E50] hover:text-[#C8963A] leading-snug">
            {r.name}
          </Link>
          <p className="m-0 mt-0.5 mb-1 text-[10px] text-[#55677A]">{r.held ? 'On Hold' : r.stage}</p>
          <Breakdown row={r} />
        </div>
      ))}
    </div>
  )
}
