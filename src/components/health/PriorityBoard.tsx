'use client'

// The portfolio priority board.
//
// A planning surface for a weekly meeting: the team looks at one list, drags it
// into the order they intend to work, and changes a stage, a status or a date
// while everyone is watching.
//
// Collapsed, a project is ONE row. Expanded, it is the whole plan — every
// discipline at once, majors with their sub-milestones underneath, each date
// editable in place. There is deliberately no per-workstream tab: in a planning
// meeting you are asking "what is happening on this site", and answering that
// behind three tabs makes the reader do the assembling.
//
// The horizon control filters DETAIL, not projects. Every active project keeps
// its row at every horizon; the horizon decides how much of its plan is worth
// showing.

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { GripVertical, ChevronRight, ChevronDown, AlertTriangle, X, RotateCcw } from 'lucide-react'
import { formatShortDate, formatDate } from '@/lib/utils'
import { SELECTABLE_STAGES } from '@/lib/stages'
import {
  varianceLabel, HEALTH_LABEL, WORKSTREAM_LABELS,
  type MilestoneStatus, type Milestone,
} from '@/lib/workstreams'
import {
  inHorizon, HORIZONS, HORIZON_LABEL,
  type PriorityRow, type Horizon, type MajorGroup,
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

export function PriorityBoard({
  rows, people, view, manual, setAt, heldCount,
}: {
  rows: PriorityRow[]
  people: { id: string; name: string; avatarUrl: string | null }[]
  view: 'table' | 'gantt'
  manual: boolean
  setAt: string | null
  heldCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  // Horizon is client state, not a URL param: it only changes how much of an
  // expanded card is shown, so a server round-trip would be latency for nothing.
  const [horizon, setHorizon] = useState<Horizon>(3)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Local order while a drag is in flight, so the row moves before the server answers. */
  const [optimistic, setOptimistic] = useState<PriorityRow[] | null>(null)

  const nameById = new Map(people.map(p => [p.id, p.name]))
  const list = optimistic ?? rows

  function withParam(key: string, value: string): string {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    return `${pathname}?${next.toString()}`
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
   */
  async function dropOn(targetId: string) {
    const dragging = dragId
    setDragId(null)
    setOverId(null)
    if (!dragging || dragging === targetId) return

    const ids = list.map(r => r.projectId)
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return

    ids.splice(to, 0, ...ids.splice(from, 1))
    const byId = new Map(list.map(r => [r.projectId, r]))
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

  const patchMilestone = (id: string, patch: Record<string, unknown>) =>
    call(`/api/workstreams/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

  const patchProject = (id: string, patch: Record<string, unknown>) =>
    call(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

  return (
    <div className="px-8 py-9 max-w-[1440px] mx-auto">
      {/* ── Header + view switch ── */}
      <div className="mb-5 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#181818] leading-tight">Portfolio priority</h1>
          <p className="mt-1.5 mb-0 text-[13.5px] text-[#3E3E3C]">
            Active projects only{manual ? '. Drag to set this week’s order.' : ', ordered by what needs attention first.'}
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

      {/* ── Horizon + order state ── */}
      <div className="flex items-center justify-between gap-5 flex-wrap mb-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.11em] text-[#706E6B]">Show milestones within</span>
          <div className="flex items-center gap-1 bg-white border border-[#D6DEE7] rounded-lg p-[3px]">
            {HORIZONS.map(h => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                aria-pressed={horizon === h}
                className={'px-2.5 py-1 rounded-[5px] text-[11.5px] font-semibold transition-colors ' +
                  (horizon === h ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')}
              >
                {HORIZON_LABEL[h]}
              </button>
            ))}
          </div>
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
            <strong className="tabular-nums text-[#181818] font-bold">{list.length}</strong> active
            {heldCount > 0 && <span className="text-[#94a3b8]"> · {heldCount} on hold, hidden</span>}
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

      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] px-6 py-14 text-center">
          <p className="m-0 text-[13.5px] text-[#3E3E3C]">No active projects. Everything is on hold or archived.</p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FAFBFC] border-b border-[#E4EAF0]">
                  <Th className="w-[54px] pl-3" />
                  <Th className="w-[26px]" />
                  <Th>Project</Th>
                  <Th>Stage</Th>
                  <Th>Phase</Th>
                  <Th>Current milestone</Th>
                  <Th>Owner</Th>
                  <Th align="right">Target</Th>
                  <Th align="right">Variance</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <BoardRow
                    key={r.projectId}
                    row={r}
                    index={i}
                    horizon={horizon}
                    open={openId === r.projectId}
                    isOver={overId === r.projectId && dragId !== r.projectId}
                    dragging={dragId === r.projectId}
                    busy={busy}
                    ownerName={r.ownerId ? nameById.get(r.ownerId) ?? null : null}
                    onToggle={() => setOpenId(openId === r.projectId ? null : r.projectId)}
                    onDragStart={() => setDragId(r.projectId)}
                    onDragEnter={() => setOverId(r.projectId)}
                    onDrop={() => dropOn(r.projectId)}
                    onPatchMilestone={patchMilestone}
                    onPatchProject={patchProject}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PriorityGantt rows={list} horizon={horizon} />
      )}

      <p className="mt-3 mb-0 mx-0.5 text-[11.5px] text-[#9AA7B4]">
        {view === 'table'
          ? 'Drag a row by its handle to set the order the team works this week — it is shared, so everyone sees the same list. Open a row to see the full plan across every discipline and edit dates in place.'
          : 'Same rows, same order as the table. Hover a marker for its milestone and date.'}
      </p>
    </div>
  )
}

// ── one project ───────────────────────────────────────────────────────

function BoardRow({
  row, index, horizon, open, isOver, dragging, busy, ownerName,
  onToggle, onDragStart, onDragEnter, onDrop, onPatchMilestone, onPatchProject,
}: {
  row: PriorityRow
  index: number
  horizon: Horizon
  open: boolean
  isOver: boolean
  dragging: boolean
  busy: boolean
  ownerName: string | null
  onToggle: () => void
  onDragStart: () => void
  onDragEnter: () => void
  onDrop: () => void
  onPatchMilestone: (id: string, patch: Record<string, unknown>) => Promise<boolean>
  onPatchProject: (id: string, patch: Record<string, unknown>) => Promise<boolean>
}) {
  const m = row.current
  const tint = row.health === 'delayed' ? '#FFFBF5' : undefined

  return (
    <>
      <tr
        draggable
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
            <GripVertical size={13} className="text-[#C6D0DA] cursor-grab" />
            <span className="text-[11px] font-bold text-[#A9B5C1] w-[16px] text-right tabular-nums">{index + 1}</span>
          </span>
        </td>
        <td className="py-2.5 align-middle">
          <button type="button" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}
                  aria-expanded={open} className="flex items-center text-[#8A6519]">
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
          {/* Inline stage edit. Choosing On Hold drops the project off this
              board on the next refresh, which is correct — a held project is
              not a priority — so the control says so rather than surprising. */}
          <select
            value={row.stage}
            disabled={busy}
            onClick={e => e.stopPropagation()}
            onChange={e => onPatchProject(row.projectId, { stage: e.target.value })}
            title={'Change the project stage. Setting On Hold removes it from this board.'}
            className="px-2 py-1 rounded-md text-[11.5px] font-semibold border border-[#D6DEE7] bg-white text-[#3E3E3C] cursor-pointer hover:bg-[#f8fafc]"
          >
            {SELECTABLE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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
      </tr>

      {open && (
        <tr className="border-b border-[#F1F5F9]" style={{ background: '#FFFBF5' }}>
          <td />
          <td />
          <td colSpan={7} className="px-3.5 pb-4 pt-0">
            <ProjectPlan row={row} horizon={horizon} busy={busy} onPatch={onPatchMilestone} />
          </td>
        </tr>
      )}
    </>
  )
}

/** The expanded card: the whole plan, every discipline, dates editable. */
function ProjectPlan({
  row, horizon, busy, onPatch,
}: {
  row: PriorityRow
  horizon: Horizon
  busy: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<boolean>
}) {
  // Only majors with something to show at this horizon. The hidden count is
  // reported rather than silently dropped, so the horizon control's effect is
  // legible instead of looking like missing data.
  const shown = row.groups
    .map(g => ({ group: g, milestones: g.milestones.filter(m => inHorizon(m, horizon)) }))
    .filter(x => x.milestones.length > 0)

  const hidden = row.groups.reduce((n, g) => n + g.milestones.length, 0)
    - shown.reduce((n, x) => n + x.milestones.length, 0)

  if (!shown.length) {
    return (
      <div className="rounded-lg bg-white border border-[#EDF1F5] px-4 py-6 text-center">
        <p className="m-0 text-[12.5px] text-[#706E6B]">
          {row.groups.length === 0
            ? 'No milestones on this project yet.'
            : `Nothing lands within ${HORIZON_LABEL[horizon]}. Widen the horizon to see the rest of the plan.`}
        </p>
      </div>
    )
  }

  // Group the majors by discipline so the card reads as three columns of one
  // plan rather than a flat list whose headings happen to change colour.
  const byWorkstream = new Map<string, typeof shown>()
  for (const x of shown) {
    const list = byWorkstream.get(x.group.workstream)
    if (list) list.push(x)
    else byWorkstream.set(x.group.workstream, [x])
  }

  return (
    <div className="rounded-lg bg-white border border-[#EDF1F5] p-3.5">
      <div className="grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {Array.from(byWorkstream.entries()).map(([ws, entries]) => (
          <section key={ws}>
            <h3 className="flex items-center gap-2 m-0 mb-2 pb-1.5 border-b border-[#EDF1F5]">
              <i className="block rounded-sm w-[3px] h-[13px]" style={{ background: LANE_HUE[ws] }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#55677A]">
                {WORKSTREAM_LABELS[ws as keyof typeof WORKSTREAM_LABELS]}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {entries.map(({ group, milestones }) => (
                <MajorBlock key={group.majorKey} group={group} milestones={milestones}
                            busy={busy} onPatch={onPatch} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-3.5 pt-2.5 border-t border-[#EDF1F5]">
        <span className="text-[11px] text-[#94a3b8]">
          {hidden > 0
            ? `${hidden} milestone${hidden === 1 ? '' : 's'} outside ${HORIZON_LABEL[horizon]} or already complete.`
            : 'Showing the whole plan.'}
        </span>
        <Link href={`/projects/${row.projectId}?tab=workstreams`}
              className="text-[12px] font-semibold text-[#2C5485] hover:underline">
          Open Workstreams →
        </Link>
      </div>
    </div>
  )
}

/** One major milestone and the sub-milestones under it. */
function MajorBlock({
  group, milestones, busy, onPatch,
}: {
  group: MajorGroup
  milestones: Milestone[]
  busy: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<boolean>
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[12.5px] font-semibold text-[#181818]">{group.majorLabel}</span>
        {group.health && (
          <i className="block w-[6px] h-[6px] rounded-full shrink-0"
             style={{ background: HEALTH_DOT[group.health] }} title={HEALTH_LABEL[group.health]} />
        )}
        <span className="ml-auto text-[10.5px] tabular-nums text-[#94a3b8]">
          {group.doneCount}/{group.totalCount}
        </span>
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-1">
        {milestones.map(m => (
          <SubMilestone key={m.id} milestone={m} busy={busy} onPatch={onPatch} />
        ))}
      </ul>
    </div>
  )
}

/** One editable sub-milestone: label, status, target date. */
function SubMilestone({
  milestone, busy, onPatch,
}: {
  milestone: Milestone
  busy: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<boolean>
}) {
  const [date, setDate] = useState(milestone.end_date ?? '')
  const s = STATUS_STYLE[milestone.status]

  // Slip is shown per sub-milestone because that is where a date actually
  // moved; the major's own variance is a roll-up of these.
  const slipped = milestone.end_date && milestone.baseline_date
    && milestone.end_date.slice(0, 10) > milestone.baseline_date.slice(0, 10)

  return (
    <li className="flex items-center gap-2 py-1 pl-2 border-l-2 border-[#EDF1F5]">
      {milestone.is_critical && (
        <i className="block w-[6px] h-[6px] rotate-45 shrink-0 bg-[#5B21B6]" title="Critical path" />
      )}
      <span className="flex-1 min-w-0 text-[12px] text-[#3E3E3C] truncate" title={milestone.label}>
        {milestone.label}
      </span>

      {slipped && (
        <span className="text-[10px] font-bold text-[#b91c1c] shrink-0"
              title={`Baseline ${formatDate(milestone.baseline_date)} — admin-locked`}>
          slipped
        </span>
      )}

      <select
        value={milestone.status}
        disabled={busy}
        onChange={e => onPatch(milestone.id, { status: e.target.value })}
        className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold border cursor-pointer shrink-0"
        style={{ background: s.bg, borderColor: s.border, color: s.text }}
      >
        {STATUSES.map(k => <option key={k} value={k}>{STATUS_STYLE[k].label}</option>)}
      </select>

      <input
        type="date"
        value={date}
        disabled={busy}
        onChange={e => setDate(e.target.value)}
        onBlur={() => {
          const next = date || null
          if ((next ?? '') !== (milestone.end_date ?? '')) onPatch(milestone.id, { end_date: next })
        }}
        className="w-[122px] shrink-0 px-1.5 py-0.5 rounded text-[10.5px] text-[#181818] border border-[#D6DEE7] bg-white outline-none focus:border-[#C8963A]"
      />
    </li>
  )
}

// ── gantt ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LANE_LABEL_PX = 210

/**
 * The same rows on a shared time axis.
 *
 * Markers, not bars: a project row here is a set of milestone dates rather than
 * one continuous span, so a bar would imply a duration no field describes.
 */
function PriorityGantt({ rows, horizon }: { rows: PriorityRow[]; horizon: Horizon }) {
  const now = new Date()
  const originY = now.getUTCFullYear()
  const originM = now.getUTCMonth()
  const months = Array.from({ length: horizon }, (_, i) => {
    const k = originM + i
    return { y: originY + Math.floor(k / 12), m: ((k % 12) + 12) % 12 }
  })

  function fraction(iso: string): number | null {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    const idx = (y - originY) * 12 + (m - 1) - originM
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const f = (idx + (d - 1) / dim) / horizon
    return f >= 0 && f <= 1 ? f : null
  }

  const colPx = horizon > 6 ? 48 : 64
  const cols = `${LANE_LABEL_PX}px repeat(${horizon}, minmax(${colPx}px, 1fr))`

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] px-4 pt-3.5 pb-3">
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: LANE_LABEL_PX + horizon * colPx }}>
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

          {rows.map((r, i) => {
            // Every open milestone inside the window, across all disciplines —
            // the Gantt is the same plan the expanded card shows, drawn on time.
            const marks = r.groups
              .flatMap(g => g.milestones)
              .filter(m => m.status !== 'complete' && m.end_date && fraction(m.end_date) !== null)
            return (
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

                {marks.map(m => (
                  <span
                    key={m.id}
                    title={`${m.label} · ${formatShortDate(m.end_date)} · ${STATUS_STYLE[m.status].label}`}
                    className="absolute top-1/2 w-[9px] h-[9px] -ml-[4.5px] -mt-[4.5px] rotate-45"
                    style={{
                      left: `calc(${LANE_LABEL_PX}px + (100% - ${LANE_LABEL_PX}px) * ${fraction(m.end_date as string)})`,
                      background: m.is_critical ? '#5B21B6' : m.status === 'blocked' ? '#92400E' : '#E6C87A',
                      opacity: m.status === 'not_started' && !m.is_critical ? 0.5 : 1,
                      zIndex: 2,
                    }}
                  />
                ))}
              </div>
            )
          })}

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
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#E6C87A]" />In progress</span>
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#92400E]" />Blocked</span>
        <span className="flex items-center gap-1.5"><i className="block w-2 h-2 rotate-45 bg-[#E6C87A] opacity-50" />Not started</span>
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
