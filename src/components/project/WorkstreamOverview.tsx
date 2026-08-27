'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { formatShortDate } from '@/lib/utils'
import {
  WORKSTREAMS, WORKSTREAM_LABELS, derivedMajorDeps, majorsFor,
  type WorkstreamKey, type MajorDef, type Milestone, type MilestoneDep, type MajorRollup,
} from '@/lib/workstreams'

// The Overview: every major milestone on one shared time axis, so the whole
// project reads as a schedule rather than three separate lists.
//
// Two controls carry the view:
//
//   Dates — Baseline shows where the plan originally said things would land;
//     Current shows where they land now; Both draws the baseline as a hatched
//     ghost above the live bar, which is the only view where slip is visible as
//     distance rather than as a number you have to read.
//
//   Scale — genuinely compresses time rather than relabelling the header. A
//     month column is 56px for one month; a quarter column is 60px for three; a
//     year column is 80px for twelve. Zooming out fits years where months were.

const LANE_LABEL_PX = 190

type Basis = 'baseline' | 'current' | 'both'
type Zoom = 'month' | 'quarter' | 'year'

const ZOOM: Record<Zoom, { label: string; monthsPerCol: number; colPx: number }> = {
  month:   { label: 'Month',   monthsPerCol: 1,  colPx: 56 },
  quarter: { label: 'Quarter', monthsPerCol: 3,  colPx: 60 },
  year:    { label: 'Year',    monthsPerCol: 12, colPx: 80 },
}

const BASIS: Record<Basis, string> = {
  baseline: 'Baseline',
  current: 'Current',
  both: 'Both',
}

const BAR: Record<MajorRollup['status'], { fill: string; text: string; border: string }> = {
  complete: { fill: '#DCFCE7', text: '#166534', border: '#86D3A6' },
  active:   { fill: '#FDF0D5', text: '#8A6519', border: '#E6C87A' },
  at_risk:  { fill: '#FEF0C7', text: '#92400E', border: '#F3D08A' },
  upcoming: { fill: '#EEF2F6', text: '#61758A', border: '#D7E0E8' },
}

const LANE_HUE: Record<WorkstreamKey, string> = {
  commercial: '#6E879E',
  technical: '#C8963A',
  approvals: '#2F3E50',
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Calendar-day parse. Never `new Date(iso)` — that is midnight UTC and shifts a day west of UTC. */
function parseDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return { y, m: m - 1, d }
}
function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
}
function monthKey(y: number, m: number) { return y * 12 + m }

export function WorkstreamOverview({
  defs, milestones, deps, rollupsByWs, onPick,
}: {
  defs: MajorDef[]
  milestones: Milestone[]
  deps: MilestoneDep[]
  rollupsByWs: Record<WorkstreamKey, MajorRollup[]>
  onPick: (majorKey: string) => void
}) {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [basis, setBasis] = useState<Basis>('current')
  const [zoom, setZoom] = useState<Zoom>('month')
  const [hovered, setHovered] = useState<string | null>(null)

  const rollupByKey = useMemo(() => {
    const out = new Map<string, MajorRollup>()
    for (const ws of WORKSTREAMS) for (const r of rollupsByWs[ws]) out.set(r.key, r)
    return out
  }, [rollupsByWs])

  /** Per-major span in each basis, plus each milestone's own target. */
  const spans = useMemo(() => {
    const out = new Map<string, {
      current: { from: string; to: string } | null
      baseline: { from: string; to: string } | null
      points: { date: string; label: string; critical: boolean }[]
    }>()

    for (const def of defs) {
      const mine = milestones.filter(m => m.major_key === def.key)
      const cur = mine.map(m => m.end_date).filter((d): d is string => !!d).sort()
      const base = mine.map(m => m.baseline_date).filter((d): d is string => !!d).sort()
      out.set(def.key, {
        current: cur.length ? { from: cur[0], to: cur[cur.length - 1] } : null,
        baseline: base.length ? { from: base[0], to: base[base.length - 1] } : null,
        points: mine
          .filter(m => m.end_date)
          .map(m => ({ date: m.end_date as string, label: m.label, critical: m.is_critical })),
      })
    }
    return out
  }, [defs, milestones])

  // ── the axis ────────────────────────────────────────────────────────
  // Always spans at least a rolling 12 months from today. A plan whose dates sit
  // a few weeks apart would otherwise collapse to one column and read as broken,
  // and real plans run 12-18 months out, so the axis is built for that even
  // before the dates catch up.
  const months = useMemo(() => {
    const dates: string[] = []
    for (const s of Array.from(spans.values())) {
      if (basis !== 'baseline' && s.current) dates.push(s.current.from, s.current.to)
      if (basis !== 'current' && s.baseline) dates.push(s.baseline.from, s.baseline.to)
    }

    const now = new Date()
    const todayKey = monthKey(now.getUTCFullYear(), now.getUTCMonth())

    let first = todayKey
    let last = todayKey + 11
    if (dates.length) {
      const keys = dates.map(d => { const p = parseDay(d); return monthKey(p.y, p.m) })
      first = Math.min(todayKey, ...keys)
      last = Math.max(todayKey + 11, ...keys)
    }

    const out: { y: number; m: number }[] = []
    for (let k = first; k <= last; k++) out.push({ y: Math.floor(k / 12), m: ((k % 12) + 12) % 12 })
    return out
  }, [spans, basis])

  const nMonths = months.length
  const originKey = nMonths ? monthKey(months[0].y, months[0].m) : 0
  const step = ZOOM[zoom].monthsPerCol

  const columns = useMemo(() => {
    const out: { label: string; sub?: string }[] = []
    for (let i = 0; i < nMonths; i += step) {
      const mo = months[i]
      if (zoom === 'month') {
        out.push({ label: MONTH_NAMES[mo.m], sub: mo.m === 0 || i === 0 ? `'${String(mo.y).slice(2)}` : undefined })
      } else if (zoom === 'quarter') {
        out.push({ label: `Q${Math.floor(mo.m / 3) + 1}`, sub: `'${String(mo.y).slice(2)}` })
      } else {
        out.push({ label: String(mo.y) })
      }
    }
    return out
  }, [months, nMonths, step, zoom])

  const fractionOf = useCallback((iso: string) => {
    const { y, m, d } = parseDay(iso)
    return monthKey(y, m) - originKey + (d - 1) / daysInMonth(y, m)
  }, [originKey])

  const pos = useCallback(
    (iso: string) => `calc(${LANE_LABEL_PX}px + (100% - ${LANE_LABEL_PX}px) * ${fractionOf(iso) / nMonths})`,
    [fractionOf, nMonths],
  )

  // Floor the width so a major whose milestones share one date still draws.
  const widthOf = useCallback((from: string, to: string) => {
    const span = Math.max(fractionOf(to) - fractionOf(from), 0.22)
    return `calc((100% - ${LANE_LABEL_PX}px) * ${span / nMonths})`
  }, [fractionOf, nMonths])

  const todayLeft = useMemo(() => {
    const now = new Date()
    const iso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
    const f = fractionOf(iso)
    return f >= 0 && f <= nMonths ? pos(iso) : null
  }, [fractionOf, nMonths, pos])

  const majorDeps = useMemo(() => derivedMajorDeps(milestones, deps), [milestones, deps])

  const litChain = useMemo(() => {
    if (!hovered) return null
    const chain = new Set<string>([hovered])
    let grew = true
    while (grew) {
      grew = false
      for (const { from, to } of majorDeps) {
        if (chain.has(to) && !chain.has(from)) { chain.add(from); grew = true }
        if (chain.has(from) && !chain.has(to)) { chain.add(to); grew = true }
      }
    }
    return chain
  }, [hovered, majorDeps])

  // ── dependency curves, measured from the laid-out DOM ───────────────
  const drawEdges = useCallback(() => {
    const grid = gridRef.current
    const svg = svgRef.current
    if (!grid || !svg) return

    const gb = grid.getBoundingClientRect()
    svg.setAttribute('viewBox', `0 0 ${gb.width} ${gb.height}`)
    svg.style.width = `${gb.width}px`
    svg.style.height = `${gb.height}px`
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    for (const { from, to } of majorDeps) {
      const a = grid.querySelector(`[data-bar="${CSS.escape(from)}"]`)
      const b = grid.querySelector(`[data-bar="${CSS.escape(to)}"]`)
      if (!a || !b) continue
      const ab = a.getBoundingClientRect()
      const bb = b.getBoundingClientRect()
      const x1 = ab.right - gb.left, y1 = ab.top + ab.height / 2 - gb.top
      const x2 = bb.left - gb.left, y2 = bb.top + bb.height / 2 - gb.top
      const mx = x1 + Math.max(16, (x2 - x1) / 2)

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`)
      path.setAttribute('fill', 'none')
      const lit = litChain?.has(from) && litChain?.has(to)
      path.setAttribute('stroke', lit ? '#C8963A' : '#C6D0DA')
      path.setAttribute('stroke-width', lit ? '1.8' : '1.2')
      if (!lit) path.setAttribute('stroke-dasharray', '3 3')
      svg.appendChild(path)
    }
  }, [majorDeps, litChain])

  useLayoutEffect(drawEdges, [drawEdges, months, zoom, basis])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(drawEdges)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [drawEdges])

  const gridCols = `${LANE_LABEL_PX}px repeat(${columns.length}, minmax(${ZOOM[zoom].colPx}px, 1fr))`
  const minWidth = LANE_LABEL_PX + columns.length * ZOOM[zoom].colPx
  const anyDates = useMemo(
    () => Array.from(spans.values()).some(s => s.current || s.baseline),
    [spans],
  )

  const Ticks = ({ keyPrefix }: { keyPrefix: string }) => (
    <>
      {columns.map((c, i) => (
        <span key={`${keyPrefix}-${c.label}-${i}`} className="h-full"
              style={{ borderLeft: i === 0 ? undefined : '1px solid #F0F4F8' }} />
      ))}
    </>
  )

  return (
    <div>
      {/* ── controls ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.11em] text-[#706E6B] mr-1">Dates</span>
          {(Object.keys(BASIS) as Basis[]).map(b => (
            <button
              key={b} type="button" onClick={() => setBasis(b)} aria-pressed={basis === b}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded border"
              style={basis === b
                ? { background: '#2F3E50', color: '#fff', borderColor: '#2F3E50' }
                : { background: '#fff', color: '#55677A', borderColor: '#D6DEE7' }}
            >
              {BASIS[b]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.11em] text-[#706E6B] mr-1">Scale</span>
          {(Object.keys(ZOOM) as Zoom[]).map(z => (
            <button
              key={z} type="button" onClick={() => setZoom(z)} aria-pressed={zoom === z}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded border"
              style={zoom === z
                ? { background: '#2F3E50', color: '#fff', borderColor: '#2F3E50' }
                : { background: '#fff', color: '#55677A', borderColor: '#D6DEE7' }}
            >
              {ZOOM[z].label}
            </button>
          ))}
        </div>
      </div>

      {!anyDates && (
        <p className="flex items-start gap-2 m-0 mb-3 px-3 py-2 rounded text-[12.5px]"
           style={{ background: '#FFFDF6', color: '#92400E', border: '1px solid #F3E4C0' }}>
          No milestone has a date yet, so the timeline is empty. Open a workstream and set
          target dates. The baseline is captured from the first target you set, and both bars
          here are drawn from those.
        </p>
      )}

      <div className="overflow-x-auto pb-2">
        <div ref={gridRef} className="relative" style={{ minWidth }}>
          {/* time header */}
          <div className="grid border-b border-[#E4EAF0]" style={{ gridTemplateColumns: gridCols }}>
            <span />
            {columns.map((c, i) => (
              <span key={`h-${c.label}-${i}`}
                    className="flex items-baseline gap-1 pb-1.5 pl-1.5"
                    style={{ borderLeft: i === 0 ? undefined : '1px solid #F0F4F8' }}>
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.07em] text-[#6E7E8E]">{c.label}</span>
                {c.sub && <span className="text-[8.5px] text-[#A9B5C1]">{c.sub}</span>}
              </span>
            ))}
          </div>

          {WORKSTREAMS.map(ws => (
            <div key={ws}>
              <div className="grid items-center border-b border-[#EDF1F5]"
                   style={{ gridTemplateColumns: gridCols, background: '#FAFCFD' }}>
                <span className="flex items-center gap-2 py-1.5 pl-1">
                  <i className="block rounded-sm" style={{ width: 3, height: 14, background: LANE_HUE[ws] }} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#55677A]">
                    {WORKSTREAM_LABELS[ws]}
                  </span>
                </span>
                <Ticks keyPrefix={`ws-${ws}`} />
              </div>

              {majorsFor(defs, ws).map(def => {
                const s = spans.get(def.key)
                const r = rollupByKey.get(def.key)
                const style = BAR[r?.status ?? 'upcoming']
                const dim = litChain ? !litChain.has(def.key) : false
                const showCurrent = basis !== 'baseline' && s?.current
                const showBaseline = basis !== 'current' && s?.baseline

                return (
                  <div key={def.key}
                       className="grid items-center relative border-b border-[#F4F7FA] last:border-0"
                       style={{ gridTemplateColumns: gridCols, minHeight: basis === 'both' ? 42 : 32 }}>
                    <button
                      type="button"
                      onClick={() => onPick(def.key)}
                      className="text-left text-[11.5px] pr-3 pl-4 truncate hover:text-[#C8963A]"
                      style={{ color: r?.status === 'upcoming' ? '#7B8794' : '#3E3E3C' }}
                      title={`Open ${def.label}`}
                    >
                      {def.label}
                    </button>

                    <Ticks keyPrefix={`row-${def.key}`} />

                    {/* baseline: hatched ghost — where the plan originally said */}
                    {showBaseline && (
                      <span
                        aria-hidden
                        className="absolute rounded-sm"
                        title={`Baseline ${formatShortDate(s!.baseline!.from)} – ${formatShortDate(s!.baseline!.to)}`}
                        style={{
                          left: pos(s!.baseline!.from),
                          width: widthOf(s!.baseline!.from, s!.baseline!.to),
                          height: 8,
                          top: basis === 'both' ? 7 : undefined,
                          border: '1px dashed #A9B5C1',
                          background: 'repeating-linear-gradient(45deg,#F4F7FA 0 3px,#E7EDF3 3px 6px)',
                          filter: dim ? 'opacity(.35)' : undefined,
                          zIndex: 1,
                        }}
                      />
                    )}

                    {/* current: the live plan */}
                    {showCurrent && (
                      <button
                        type="button"
                        data-bar={def.key}
                        onClick={() => onPick(def.key)}
                        onMouseEnter={() => setHovered(def.key)}
                        onMouseLeave={() => setHovered(null)}
                        onFocus={() => setHovered(def.key)}
                        onBlur={() => setHovered(null)}
                        title={`${def.label} · ${formatShortDate(s!.current!.from)} – ${formatShortDate(s!.current!.to)}${
                          r?.variance != null ? ` · ${r.variance >= 0 ? '+' : ''}${r.variance}d variance` : ''}`}
                        className="absolute rounded-sm"
                        style={{
                          left: pos(s!.current!.from),
                          width: widthOf(s!.current!.from, s!.current!.to),
                          height: 17,
                          top: basis === 'both' ? 19 : undefined,
                          background: style.fill,
                          border: `1px solid ${style.border}`,
                          boxShadow: r?.hasCritical ? 'inset 0 0 0 1.5px #5B21B6' : undefined,
                          filter: dim ? 'saturate(.25) opacity(.45)' : undefined,
                          transition: 'filter .15s',
                          zIndex: 2,
                        }}
                      >
                        {/* a diamond per milestone target, so the bar shows its parts */}
                        {s!.points.map(pt => {
                          const spanDays = Math.max(
                            fractionOf(s!.current!.to) - fractionOf(s!.current!.from), 0.0001)
                          const at = (fractionOf(pt.date) - fractionOf(s!.current!.from)) / spanDays
                          return (
                            <span
                              key={pt.date + pt.label}
                              aria-hidden
                              className="absolute top-1/2"
                              title={pt.label}
                              style={{
                                left: `${Math.min(Math.max(at, 0), 1) * 100}%`,
                                width: 6, height: 6, marginLeft: -3, marginTop: -3,
                                transform: 'rotate(45deg)',
                                background: pt.critical ? '#5B21B6' : style.text,
                                opacity: pt.critical ? 1 : 0.6,
                              }}
                            />
                          )
                        })}
                      </button>
                    )}

                    {!showCurrent && !showBaseline && (
                      <span className="absolute text-[10.5px] text-[#C6D0DA] pointer-events-none"
                            style={{ left: `calc(${LANE_LABEL_PX}px + 8px)` }}>
                        {basis === 'baseline' ? 'No Baseline Set' : 'No Dates Set'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {todayLeft && (
            <div aria-hidden className="absolute top-0 bottom-0 w-px z-[3] pointer-events-none"
                 style={{ left: todayLeft, background: '#EF4444' }}>
              <span className="absolute text-[8.5px] font-semibold tracking-[0.1em] px-[3px] rounded-sm bg-white"
                    style={{ top: 0, left: 3, color: '#991B1B' }}>
                TODAY
              </span>
            </div>
          )}

          <svg ref={svgRef} aria-hidden className="absolute inset-0 z-[1] pointer-events-none overflow-visible" />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-[#E4EAF0] text-[11.5px] text-[#706E6B]">
        <span className="flex items-center gap-1.5">
          <i className="block rounded-sm" style={{
            width: 18, height: 8, border: '1px dashed #A9B5C1',
            background: 'repeating-linear-gradient(45deg,#F4F7FA 0 3px,#E7EDF3 3px 6px)',
          }} />
          Baseline
        </span>
        {(['complete', 'active', 'at_risk', 'upcoming'] as const).map(k => (
          <span key={k} className="flex items-center gap-1.5">
            <i className="block rounded-sm" style={{ width: 18, height: 10, background: BAR[k].fill, border: `1px solid ${BAR[k].border}` }} />
            {k === 'at_risk' ? 'At risk' : k[0].toUpperCase() + k.slice(1)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="block" style={{ width: 7, height: 7, background: '#5B21B6', transform: 'rotate(45deg)' }} />
          Milestone · Violet Is Critical Path
        </span>
        <span className="text-[#9AA7B4]">Hover a bar to trace its dependency chain · click to open</span>
      </div>
    </div>
  )
}
