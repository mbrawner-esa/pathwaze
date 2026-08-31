'use client'

// The portfolio priority board.
//
// A planning surface for a weekly meeting: the team looks at one list, drags it
// into the order they intend to work, and moves a status or a date while
// everyone is watching. Two views over the same rows in the same order — a
// table (default) and a Gantt — because the same conversation needs both "what
// are we doing" and "when does it land".
//
// Density is deliberate. This is an operations tool, so the table is tight and
// the controls sit on one line; the restraint is in WHAT is shown (one row per
// project, one milestone per row), not in spacing it out.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { GripVertical, ChevronRight, ChevronDown, AlertTriangle, X, RotateCcw, Calendar } from 'lucide-react'
import { formatShortDate, formatDate } from '@/lib/utils'
import { varianceLabel, HEALTH_LABEL, WORKSTREAM_LABELS, type MilestoneStatus } from '@/lib/workstreams'
import {
  applyFilters, filterCounts, LENSES, HORIZONS, HORIZON_LABEL,
  type PriorityRow, type PriorityFilter, type Horizon, type Lens,
} from '@/lib/portfolio-priority'

/** Lane accent per workstream — same hues the project Overview uses. */
const LANE_HUE: Record<string, string> = {
  commercial: '#6E879E',
  technical: '#C8963A',
  approvals: '#2F3E50',
}

const HEALTH_DOT: Record<string, string> = {
  delayed: '#ef4444',
  at_risk: '#eab308',
  on_track: '#22c55e',
}

const STATUS_STYLE: Record<MilestoneStatus, { bg: string; border: string; text: string; label: string }> = {
  not_started: { bg: '#EEF2F6', border: '#D7E0E8', text: '#61758A', label: 'Not started' },
  in_progress: { bg: '#FDF0D5', border: '#E6C87A', text: '#8A6519', label: 'In progress' },
  blocked:     { bg: '#FEF0C7', border: '#F3D08A', text: '#92400E', label: 'Blocked' },
  complete:    { bg: '#DCFCE7', border: '#86D3A6', text: '#166534', label: 'Complete' },
}

const STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'blocked', 'complete']

const CHIPS: { key: PriorityFilter; label: string; dot: string; border: string; text: string }[] = [
  { key: 'delayed',  label: 'Delayed',       dot: '#ef4444', border: '#F0B4B4', text: '#b91c1c' },
  { key: 'at_risk',  label: 'At risk',       dot: '#eab308', border: '#EFD79B', text: '#92400E' },
  { key: 'critical', label: 'Critical path', dot: '#5B21B6', border: '#CBB6E8', text: '#5B21B6' },
]

export function PriorityBoard({
  rows, people, lens, horizon, view, manual, setAt, heldCount,
}: {
  rows: PriorityRow[]
  people: { id: string; name: string; avatarUrl: string | null }[]
  lens: Lens
  horizon: Horizon
  view: 'table' | 'gantt'
  manual: boolean
  setAt: string | null
  heldCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const [filters, setFilters] = useState<PriorityFilter[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Local order while a drag is in flight, so the row moves before the server answers. */
  const [optimistic, setOptimistic] = useState<PriorityRow[] | null>(null)

  const nameById = new Map(people.map(p => [p.id, p.name]))
  const base = optimistic ?? rows
  const counts = filterCounts(base)
  const visible = applyFilters(base, filters)

  /** Build a URL with one param changed — the view/lens/horizon controls are links. */
  function withParam(key: string, value: string): string {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    return `${pathname}?${next.toString()}`
  }

  function toggleFilter(f: PriorityFilter) {
    setFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'That did not save. Try again.')
        return false
      }
      startTransition(() => router.refresh())
      return true
    } catch {
      setError('That did not save. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  /**
   * Drag-to-reprioritize. Same splice-then-PATCH shape the Workstreams plan
   * uses, so both reorder gestures behave identically.
   *
   * Reordering is disabled while a filter is on: the visible list is then a
   * subset, and dropping row 2 onto row 5 of a filtered view says nothing about
   * where it belongs among the rows you cannot see.
   */
  async function dropOn(targetId: string) {
    const dragging = dragId
    setDragId(null)
    setOverId(null)
    if (!dragging || dragging === targetId || filters.length) return

    const ids = base.map(r => r.projectId)
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return

    ids.splice(to, 0, ...ids.splice(from, 1))
    const byId = new Map(base.map(r => [r.projectId, r]))
    setOptimistic(ids.map(id => byId.get(id) as PriorityRow))

    const ok = await call('/api/portfolio-priority', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    // The refresh brings the server's order back; drop the local copy either
    // way, so a failed save visibly snaps back rather than lying.
    setOptimistic(null)
    if (!ok) router.refresh()
  }

  async function resetOrder() {
    setOptimistic(null)
    await call('/api/portfolio-priority', { method: 'DELETE' })
  }

  /** Inline edit of the current milestone. */
  async function patchMilestone(id: string, patch: Record<string, unknown>) {
    await call(`/api/workstreams/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  return (
    <div className="px-8 py-9 max-w-[1400px] mx-auto">
      {/* ── Header + view switch ── */}
      <div className="mb-5 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#181818] leading-tight">Portfolio priority</h1>
          <p className="mt-1.5 mb-0 text-[13.5px] text-[#3E3E3C]">
            Active projects only{manual ? '. Drag to set this week’s priority order.' : ', ordered by what needs attention first.'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#D6DEE7] rounded-lg p-1">
          {(['table', 'gantt'] as const).map(v => (
            <Link
              key={v}
              href={withParam('view', v)}
              className={'px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ' +
                (view === v ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')}
            >
              {v === 'table' ? 'Table' : 'Gantt'}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Lens + horizon ── */}
      <div className="flex items-center justify-between gap-5 flex-wrap mb-3">
        <div className="flex items-center gap-1.5">
          {LENSES.map(l => (
            <Link
              key={l.key}
              href={withParam('lens', l.key)}
              className={'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold border transition-colors ' +
                (lens === l.key
                  ? 'bg-[#2F3E50] text-white border-[#2F3E50]'
                  : 'bg-white text-[#55677A] border-[#D6DEE7] hover:bg-[#f8fafc]')}
            >
              {l.key !== 'overview' && (
                <i className="block rounded-sm w-[3px] h-[12px]" style={{ background: LANE_HUE[l.key] }} />
              )}
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#D6DEE7] rounded-lg p-[3px]">
          {HORIZONS.map(h => (
            <Link
              key={h}
              href={withParam('horizon', String(h))}
              className={'px-2.5 py-1 rounded-[5px] text-[11.5px] font-semibold transition-colors ' +
                (horizon === h ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')}
            >
              {HORIZON_LABEL[h]}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Filters + scope ── */}
      <div className="flex items-center justify-between gap-5 flex-wrap mb-3.5">
        <div className="flex items-center gap-1.5">
          {CHIPS.map(c => {
            const on = filters.includes(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleFilter(c.key)}
                aria-pressed={on}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors"
                style={on
                  ? { background: c.text, borderColor: c.text, color: '#fff' }
                  : { background: '#fff', borderColor: c.border, color: c.text }}
              >
                {c.key === 'critical'
                  ? <i className="block w-[7px] h-[7px] rotate-45" style={{ background: on ? '#fff' : c.dot }} />
                  : <i className="block w-[7px] h-[7px] rounded-full" style={{ background: on ? '#fff' : c.dot }} />}
                {c.label}
                <span className="tabular-nums opacity-60">{counts[c.key]}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          {manual && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8A6519] bg-[#FDF0D5] border border-[#E6C87A] rounded-full px-3 py-1.5">
              <RotateCcw size={11} />
              Manual order{setAt ? ` · set ${formatShortDate(setAt)}` : ''}
              <button type="button" onClick={resetOrder} disabled={busy}
                      className="underline font-bold hover:text-[#5E4511]">
                Reset to urgency
              </button>
            </span>
          )}
          <span className="text-[12px] text-[#55677A]">
            <strong className="tabular-nums text-[#181818] font-bold">{base.length}</strong> active
            {heldCount > 0 && <span className="text-[#94a3b8]"> · {heldCount} on hold, excluded</span>}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[12.5px] bg-[#FEF2F2] text-[#991B1B]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {filters.length > 0 && (
        <p className="m-0 mb-2 text-[11.5px] text-[#94a3b8]">
          Reordering is off while a filter is on — clear the filters to drag.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] px-6 py-14 text-center">
          <p className="m-0 text-[13.5px] text-[#3E3E3C]">
            {base.length === 0
              ? 'No active projects. Everything is on hold or archived.'
              : 'Nothing matches those filters.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <PriorityTable
          rows={visible}
          nameById={nameById}
          openId={openId}
          setOpenId={setOpenId}
          dragId={dragId}
          overId={overId}
          setDragId={setDragId}
          setOverId={setOverId}
          dropOn={dropOn}
          dragEnabled={filters.length === 0}
          busy={busy}
          onPatch={patchMilestone}
        />
      ) : (
        <PriorityGantt rows={visible} horizon={horizon} />
      )}

      <p className="mt-3 mb-0 mx-0.5 text-[11.5px] text-[#9AA7B4]">
        {view === 'table'
          ? 'Drag a row by its handle to set the order the team works this week — it is shared, so everyone sees the same list. Click a row to read its latest note and change status or target date.'
          : 'Same rows, same order as the table. Hover a marker for its milestone and date.'}
      </p>
    </div>
  )
}

// ── table ─────────────────────────────────────────────────────────────

function PriorityTable({
  rows, nameById, openId, setOpenId, dragId, overId, setDragId, setOverId,
  dropOn, dragEnabled, busy, onPatch,
}: {
  rows: PriorityRow[]
  nameById: Map<string, string>
  openId: string | null
  setOpenId: (id: string | null) => void
  dragId: string | null
  overId: string | null
  setDragId: (id: string | null) => void
  setOverId: (id: string | null) => void
  dropOn: (id: string) => void
  dragEnabled: boolean
  busy: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E4EAF0]">
              <Th className="w-[52px] pl-3" />
              <Th className="w-[28px]" />
              <Th>Project</Th>
              <Th>Phase</Th>
              <Th>Current milestone</Th>
              <Th>Owner</Th>
              <Th align="right">Target</Th>
              <Th align="right">Variance</Th>
              <Th>Next critical</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const open = openId === r.projectId
              const isOver = overId === r.projectId && dragId !== r.projectId
              return (
                <PriorityRowPair
                  key={r.projectId}
                  row={r}
                  index={i}
                  open={open}
                  isOver={isOver}
                  dragging={dragId === r.projectId}
                  dragEnabled={dragEnabled}
                  busy={busy}
                  ownerName={r.ownerId ? nameById.get(r.ownerId) ?? null : null}
                  onToggle={() => setOpenId(open ? null : r.projectId)}
                  onDragStart={() => setDragId(r.projectId)}
                  onDragEnter={() => setOverId(r.projectId)}
                  onDrop={() => dropOn(r.projectId)}
                  onPatch={onPatch}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PriorityRowPair({
  row, index, open, isOver, dragging, dragEnabled, busy, ownerName,
  onToggle, onDragStart, onDragEnter, onDrop, onPatch,
}: {
  row: PriorityRow
  index: number
  open: boolean
  isOver: boolean
  dragging: boolean
  dragEnabled: boolean
  busy: boolean
  ownerName: string | null
  onToggle: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const m = row.current
  const tint = row.health === 'delayed' ? '#FFFBF5' : undefined

  return (
    <>
      <tr
        draggable={dragEnabled}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}
        className="border-b border-[#F1F5F9] hover:bg-[#fafbfc] transition-colors"
        style={{
          background: open ? '#FFFBF5' : tint,
          boxShadow: isOver ? 'inset 0 2px 0 #C8963A' : undefined,
          opacity: dragging ? 0.4 : 1,
        }}
      >
        <td className="py-2.5 pl-3 align-middle">
          <span className="inline-flex items-center gap-1.5">
            <GripVertical
              size={13}
              className={dragEnabled ? 'text-[#C6D0DA] cursor-grab' : 'text-[#EDF1F5]'}
            />
            <span className="text-[11px] font-bold text-[#A9B5C1] w-[16px] text-right tabular-nums">{index + 1}</span>
          </span>
        </td>
        <td className="py-2.5 align-middle">
          <button type="button" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}
                  className="flex items-center text-[#8A6519]">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} className="text-[#C6D0DA]" />}
          </button>
        </td>
        <Td>
          <span className="inline-flex items-center gap-2">
            {row.health && (
              <i className="block w-[7px] h-[7px] rounded-full shrink-0"
                 style={{ background: HEALTH_DOT[row.health] }}
                 title={HEALTH_LABEL[row.health]} />
            )}
            <Link href={`/projects/${row.projectId}`}
                  className="text-[13px] font-semibold text-[#181818] hover:text-[#2C5485] hover:underline">
              {row.name}
            </Link>
          </span>
        </Td>
        <Td>
          {row.phaseLabel ? (
            <span className="inline-flex items-center gap-1.5">
              {row.phaseWorkstream && (
                <i className="block rounded-sm w-[3px] h-[11px] shrink-0"
                   style={{ background: LANE_HUE[row.phaseWorkstream] }}
                   title={WORKSTREAM_LABELS[row.phaseWorkstream]} />
              )}
              {row.phaseLabel}
            </span>
          ) : <span className="text-[#C6D0DA]">—</span>}
        </Td>
        <Td>
          {m ? (
            <span className="inline-flex items-center gap-1.5">
              {m.is_critical && (
                <i className="block w-[7px] h-[7px] rotate-45 shrink-0 bg-[#5B21B6]" title="Critical path" />
              )}
              <span className="text-[#181818] font-medium">{m.label}</span>
            </span>
          ) : <span className="text-[#C6D0DA]">Nothing planned</span>}
        </Td>
        <Td>{ownerName ?? <span className="text-[#C6D0DA]">—</span>}</Td>
        <Td align="right" className="tabular-nums">
          {m?.end_date ? formatShortDate(m.end_date) : <span className="text-[#C6D0DA]">—</span>}
        </Td>
        <Td align="right" className="tabular-nums font-bold"
            style={{ color: (row.variance ?? 0) < 0 ? '#b91c1c' : row.health === 'at_risk' ? '#92400E' : '#3E3E3C' }}>
          {varianceLabel(row.variance) ?? <span className="text-[#C6D0DA] font-normal">—</span>}
        </Td>
        <Td className="text-[#706E6B]">
          {row.nextCritical
            ? `${row.nextCritical.label} · ${formatShortDate(row.nextCritical.date)}`
            : <span className="text-[#C6D0DA]">None in window</span>}
        </Td>
      </tr>

      {open && m && (
        <tr className="border-b border-[#F1F5F9]" style={{ background: '#FFFBF5' }}>
          <td />
          <td />
          <td colSpan={7} className="px-3.5 pb-3.5 pt-0">
            <MilestoneDetail row={row} milestone={m} busy={busy} onPatch={onPatch} />
          </td>
        </tr>
      )}
    </>
  )
}

/** The expanded row: latest note plus the two fields worth changing in a meeting. */
function MilestoneDetail({
  row, milestone, busy, onPatch,
}: {
  row: PriorityRow
  milestone: NonNullable<PriorityRow['current']>
  busy: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>
}) {
  const [date, setDate] = useState(milestone.end_date ?? '')
  const s = STATUS_STYLE[milestone.status]

  return (
    <div className="flex gap-3.5 flex-wrap items-stretch">
      <div className="flex-1 min-w-[320px] px-3.5 py-3 rounded-lg bg-white border border-[#EDF1F5]">
        <p className="m-0 mb-1 text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#94a3b8]">
          {milestone.risk ? 'Risk' : 'Notes'}
        </p>
        {milestone.risk || milestone.notes ? (
          <div className="text-[12.5px] text-[#3E3E3C] leading-snug [&_p]:m-0 [&_ul]:my-1 [&_ul]:pl-4"
               dangerouslySetInnerHTML={{ __html: milestone.risk || milestone.notes || '' }} />
        ) : (
          <p className="m-0 text-[12.5px] text-[#94a3b8]">
            No note yet. Add one on the project&apos;s Workstreams tab.
          </p>
        )}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <label className="block">
          <span className="block mb-1 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#706E6B]">Status</span>
          <select
            value={milestone.status}
            disabled={busy}
            onChange={e => onPatch(milestone.id, { status: e.target.value })}
            className="px-2.5 py-1.5 rounded-md text-[12px] font-semibold border cursor-pointer"
            style={{ background: s.bg, borderColor: s.border, color: s.text }}
          >
            {STATUSES.map(k => <option key={k} value={k}>{STATUS_STYLE[k].label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="block mb-1 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#706E6B]">Target</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#D6DEE7] bg-white">
            <Calendar size={11} className="text-[#6E879E]" />
            <input
              type="date"
              value={date}
              disabled={busy}
              onChange={e => setDate(e.target.value)}
              onBlur={() => {
                if (date && date !== milestone.end_date) onPatch(milestone.id, { end_date: date })
              }}
              className="text-[12px] text-[#181818] outline-none bg-transparent"
            />
          </span>
        </label>

        <Link href={`/projects/${row.projectId}?tab=workstreams`}
              className="px-1 py-2 text-[12px] font-semibold text-[#2C5485] hover:underline">
          Open →
        </Link>
      </div>

      {milestone.baseline_date && (
        <p className="basis-full m-0 text-[11px] text-[#94a3b8]">
          Baseline {formatDate(milestone.baseline_date)} — locked. Only an admin can re-baseline, so slip stays measurable.
        </p>
      )}
    </div>
  )
}

// ── gantt ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LANE_LABEL_PX = 210

/**
 * The same rows on a shared time axis.
 *
 * Deliberately markers-only, not bars: a project row here is a selection of its
 * milestones rather than one continuous span, so a bar would imply a duration
 * that no field in the data actually describes.
 */
function PriorityGantt({ rows, horizon }: { rows: PriorityRow[]; horizon: Horizon }) {
  const now = new Date()
  const originY = now.getUTCFullYear()
  const originM = now.getUTCMonth()
  const months = Array.from({ length: horizon }, (_, i) => {
    const k = originM + i
    return { y: originY + Math.floor(k / 12), m: ((k % 12) + 12) % 12 }
  })

  /** Position as a fraction of the axis, month-proportional like the project Overview. */
  function fraction(iso: string): number | null {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    const idx = (y - originY) * 12 + (m - 1) - originM
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const f = (idx + (d - 1) / dim) / horizon
    return f >= 0 && f <= 1 ? f : null
  }

  const cols = `${LANE_LABEL_PX}px repeat(${horizon}, minmax(${horizon > 6 ? 48 : 64}px, 1fr))`

  function Marker({ iso, critical, dim, title }: {
    iso: string; critical: boolean; dim: boolean; title: string
  }) {
    const f = fraction(iso)
    if (f === null) return null
    return (
      <span
        title={title}
        className="absolute top-1/2 w-[9px] h-[9px] -ml-[4.5px] -mt-[4.5px] rotate-45"
        style={{
          left: `calc(${LANE_LABEL_PX}px + (100% - ${LANE_LABEL_PX}px) * ${f})`,
          background: critical ? '#5B21B6' : dim ? '#61758A' : '#E6C87A',
          opacity: dim ? 0.45 : 1,
          zIndex: 2,
        }}
      />
    )
  }

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] px-4 pt-3.5 pb-3">
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: LANE_LABEL_PX + horizon * (horizon > 6 ? 48 : 64) }}>
          {/* axis */}
          <div className="grid border-b border-[#E4EAF0]" style={{ gridTemplateColumns: cols }}>
            <span />
            {months.map((mo, i) => (
              <span key={`${mo.y}-${mo.m}`} className="flex items-baseline gap-1 pb-1.5 pl-2"
                    style={{ borderLeft: i === 0 ? undefined : '1px solid #F0F4F8' }}>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#6E7E8E]">{MONTHS[mo.m]}</span>
                {(mo.m === 0 || i === 0) && (
                  <span className="text-[8.5px] text-[#A9B5C1]">&apos;{String(mo.y).slice(2)}</span>
                )}
              </span>
            ))}
          </div>

          {rows.map((r, i) => (
            <div key={r.projectId}
                 className="grid items-center relative border-b border-[#F4F7FA] last:border-0"
                 style={{ gridTemplateColumns: cols, minHeight: 36, background: r.health === 'delayed' ? '#FFFBF5' : undefined }}>
              <span className="flex items-center gap-2 pl-3 pr-2.5">
                <span className="text-[11px] font-bold text-[#A9B5C1] w-[16px] tabular-nums">{i + 1}</span>
                {r.health && (
                  <i className="block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: HEALTH_DOT[r.health] }} />
                )}
                <Link href={`/projects/${r.projectId}`}
                      className="text-[12.5px] font-semibold text-[#181818] truncate hover:text-[#2C5485] hover:underline">
                  {r.name}
                </Link>
              </span>
              {months.map((mo, c) => (
                <span key={`${r.projectId}-${mo.y}-${mo.m}`} className="h-full"
                      style={{ borderLeft: c === 0 ? undefined : '1px solid #F0F4F8' }} />
              ))}

              {r.current?.end_date && (
                <Marker
                  iso={r.current.end_date}
                  critical={r.current.is_critical}
                  dim={false}
                  title={`${r.current.label} · ${formatShortDate(r.current.end_date)} · ${STATUS_STYLE[r.current.status].label}`}
                />
              )}
              {r.nextCritical && (
                <Marker
                  iso={r.nextCritical.date}
                  critical
                  dim
                  title={`${r.nextCritical.label} · ${formatShortDate(r.nextCritical.date)} · upcoming`}
                />
              )}
            </div>
          ))}

          {/* today — always the left edge, since the window opens now */}
          <div aria-hidden className="absolute top-0 bottom-0 w-px z-[3] pointer-events-none"
               style={{ left: LANE_LABEL_PX, background: '#EF4444' }}>
            <span className="absolute -top-0.5 left-[3px] text-[8.5px] font-bold tracking-[0.1em] px-[3px] rounded-sm bg-white text-[#991B1B]">
              TODAY
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-3 pt-2.5 border-t border-[#E4EAF0] text-[11.5px] text-[#706E6B]">
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#5B21B6]" />Critical path</span>
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#E6C87A]" />Current milestone</span>
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#61758A] opacity-45" />Next critical</span>
      </div>
    </div>
  )
}

// ── table primitives ──────────────────────────────────────────────────

function Th({ children, align = 'left', className = '' }: {
  children?: React.ReactNode; align?: 'left' | 'right'; className?: string
}) {
  return (
    <th className={`px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#706E6B] ${className}`}
        style={{ textAlign: align }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left', className = '', style }: {
  children?: React.ReactNode; align?: 'left' | 'right'; className?: string; style?: React.CSSProperties
}) {
  return (
    <td className={`px-3.5 py-2.5 text-[12.5px] text-[#3E3E3C] align-middle ${className}`}
        style={{ textAlign: align, ...style }}>
      {children}
    </td>
  )
}
