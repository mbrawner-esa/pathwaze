'use client'

// The portfolio priority board.
//
// A planning surface for a weekly meeting: the team looks at one list, drags it
// into the order they intend to work, and changes a stage, a status or a date
// while everyone is watching.
//
// Collapsed, a project is ONE row. Expanded, it is the whole plan — every
// discipline at once, majors with their sub-milestones underneath.
//
// EDITING IS RECORD-LEVEL AND EXPLICIT. Nothing is an input until you say so.
// Each row carries ONE always-visible pencil; clicking it once turns every
// editable field on that row into a control, and the Save / Cancel bar commits
// them together and returns the row to read-only.
//
// Two earlier shapes were wrong. Live inputs that save on blur make a read-only
// glance feel like a form and turn a stray click into an unannounced write. A
// pencil per field hidden behind hover makes editing a three-step gesture —
// find the row, hover it, then aim at a 10px target — and leaves you asking
// which of the row's pencils is the one you want.

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  GripVertical, ChevronRight, ChevronDown, AlertTriangle, X, RotateCcw, Pencil, Check, Sparkles,
  MessageSquare, Target,
} from 'lucide-react'
import { formatShortDate, formatDate } from '@/lib/utils'
import { SELECTABLE_STAGES } from '@/lib/stages'
import {
  HEALTH_LABEL, WORKSTREAM_LABELS, WORKSTREAMS,
  type MilestoneStatus, type WorkstreamKey,
} from '@/lib/workstreams'
import {
  inHorizon, filterRows, filterOptions, groupRows, byDueDate, byFocus,
  HORIZONS, HORIZON_LABEL, HORIZON_HINT, HORIZON_GANTT_MONTHS, GROUP_LABEL, EMPTY_FILTERS,
  type PriorityRow, type Horizon, type BoardFilters, type GroupBy, type CardMilestone,
} from '@/lib/portfolio-priority'
import { BAND_COLOR, BAND_LABEL, momentumSummary } from '@/lib/momentum'
import { RISK_BAND_COLOR, RISK_BAND_LABEL } from '@/lib/risk'
import { MomentumChart } from './MomentumChart'
import { CommentThread } from './CommentThread'

const LANE_HUE: Record<string, string> = {
  commercial: '#6E879E',
  technical: '#C8963A',
  approvals: '#2F3E50',
}

const HEALTH_DOT: Record<string, string> = {
  delayed: '#ef4444', at_risk: '#eab308', on_track: '#22c55e',
}

const STATUS_STYLE: Record<MilestoneStatus, { bg: string; border: string; text: string; label: string }> = {
  not_started: { bg: '#EEF2F6', border: '#D7E0E8', text: '#61758A', label: 'Not Started' },
  in_progress: { bg: '#FDF0D5', border: '#E6C87A', text: '#8A6519', label: 'In Progress' },
  blocked:     { bg: '#FEF0C7', border: '#F3D08A', text: '#92400E', label: 'Blocked' },
  complete:    { bg: '#DCFCE7', border: '#86D3A6', text: '#166534', label: 'Complete' },
}

const STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'blocked', 'complete']

/** A staged, uncommitted change. Keyed `<kind>:<id>:<field>`. */
type EditKey = string
interface PendingEdit { kind: 'project' | 'milestone'; id: string; field: string; value: string }

export function PriorityBoard({
  rows, view, manual, heldCount, riskScored,
}: {
  rows: PriorityRow[]
  people: { id: string; name: string; avatarUrl: string | null }[]
  view: 'table' | 'graph' | 'gantt'
  manual: boolean
  heldCount: number
  /** how many projects already carry a cached risk score */
  riskScored: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const [horizon, setHorizon] = useState<Horizon>('near')
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS)
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [focusOnly, setFocusOnly] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [optimistic, setOptimistic] = useState<PriorityRow[] | null>(null)

  // Lightning-style editing: which fields are open as controls, and what has
  // been staged but not yet saved.
  const [editingKeys, setEditingKeys] = useState<Set<EditKey>>(new Set())
  const [edits, setEdits] = useState<Record<EditKey, PendingEdit>>({})
  const pendingCount = Object.keys(edits).length

  const list = optimistic ?? rows
  const opts = useMemo(() => filterOptions(list), [list])
  const filtered = useMemo(() => filterRows(list, filters), [list, filters])
  const groups = useMemo(() => groupRows(filtered, groupBy), [filtered, groupBy])
  const filtersOn = filters.workstream !== 'all' || filters.pm !== 'all' || filters.tranche !== 'all'

  function withParam(key: string, value: string): string {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    return `${pathname}?${next.toString()}`
  }

  async function call(url: string, init: RequestInit): Promise<boolean> {
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'That did not save. Try again.')
        return false
      }
      return true
    } catch {
      setError('That did not save. Try again.')
      return false
    }
  }

  // ── editing ──
  /**
   * Put a whole record into edit mode.
   *
   * Salesforce Lightning offers both: a pencil per field for a one-value fix,
   * and Edit on the record for "I am going to change several things". Editing a
   * site row one pencil at a time is the wrong shape for the second case, which
   * is what a planning meeting actually does.
   */
  function openFields(keys: EditKey[]) {
    setEditingKeys(prev => {
      const next = new Set(prev)
      for (const k of keys) next.add(k)
      return next
    })
  }
  /**
   * Close one record's fields again, discarding anything staged on them.
   *
   * Scoped rather than global: cancelling the project you opened by mistake
   * must not throw away edits you already made to a different one.
   */
  function cancelRecord(keys: EditKey[]) {
    const drop = new Set(keys)
    setEditingKeys(prev => new Set(Array.from(prev).filter(k => !drop.has(k))))
    setEdits(prev => Object.fromEntries(
      Object.entries(prev).filter(([k]) => !drop.has(k))))
  }
  function stage(key: EditKey, edit: PendingEdit) {
    setEdits(prev => ({ ...prev, [key]: edit }))
  }
  function cancelEdits() {
    setEdits({})
    setEditingKeys(new Set())
    setError(null)
  }
  async function saveEdits() {
    setBusy(true)
    setError(null)
    // Group by entity so two fields on one record are one request, and so a
    // milestone's status and date never race each other.
    const byEntity = new Map<string, { kind: string; id: string; patch: Record<string, unknown> }>()
    for (const e of Object.values(edits)) {
      const k = `${e.kind}:${e.id}`
      const entry = byEntity.get(k) ?? { kind: e.kind, id: e.id, patch: {} }
      entry.patch[e.field] = e.value === '' ? null : e.value
      byEntity.set(k, entry)
    }
    let ok = true
    for (const e of Array.from(byEntity.values())) {
      const url = e.kind === 'project'
        ? `/api/projects/${e.id}`
        : `/api/workstreams/milestones/${e.id}`
      // eslint-disable-next-line no-await-in-loop
      const done = await call(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e.patch),
      })
      if (!done) { ok = false; break }
    }
    setBusy(false)
    if (ok) {
      setEdits({})
      setEditingKeys(new Set())
      startTransition(() => router.refresh())
    }
  }

  // ── drag ──
  async function dropOn(targetId: string) {
    const dragging = dragId
    setDragId(null)
    setOverId(null)
    if (!dragging || dragging === targetId || filtersOn || groupBy !== 'none') return

    const ids = list.map(r => r.projectId)
    const from = ids.indexOf(dragging)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    const byId = new Map(list.map(r => [r.projectId, r]))
    setOptimistic(ids.map(id => byId.get(id) as PriorityRow))

    setBusy(true)
    const ok = await call('/api/portfolio-priority', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setBusy(false)
    setOptimistic(null)
    startTransition(() => router.refresh())
    if (!ok) router.refresh()
  }

  /**
   * Reorder a project's milestones. Reuses the batch endpoint the Workstreams
   * plan already uses, which rewrites sort_order from the given id order.
   *
   * sort_order is documented as position WITHIN a major, and the ids sent here
   * span the whole project — that is safe and deliberate. Rewriting them
   * project-wide keeps every milestone's order relative to its siblings intact,
   * so the Workstreams tab still reads correctly; it simply also gives the flat
   * card a stable cross-major order to render.
   */
  async function reorderMilestones(ids: string[]): Promise<boolean> {
    setBusy(true)
    const ok = await call('/api/workstreams/milestones', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setBusy(false)
    startTransition(() => router.refresh())
    return ok
  }

  /** Mark or unmark a milestone as this week's focus. Shared, not per-user. */
  async function onFocus(milestoneId: string, next: boolean): Promise<boolean> {
    setBusy(true)
    const ok = next
      ? await call('/api/workstreams/focus', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ milestone_id: milestoneId }),
        })
      : await call(`/api/workstreams/focus?milestone_id=${encodeURIComponent(milestoneId)}`,
          { method: 'DELETE' })
    setBusy(false)
    startTransition(() => router.refresh())
    return ok
  }

  async function resetOrder() {
    setOptimistic(null)
    setBusy(true)
    await call('/api/portfolio-priority', { method: 'DELETE' })
    setBusy(false)
    startTransition(() => router.refresh())
  }

  /**
   * Complexity scoring is an explicit action, never something a render triggers:
   * it calls a third-party model and costs money per project. Unchanged
   * projects are skipped server-side on their fingerprint, so pressing this
   * twice does not bill twice.
   */
  const [scoring, setScoring] = useState(false)
  const [scoreNote, setScoreNote] = useState<string | null>(null)
  async function rescoreRisk() {
    setScoring(true)
    setScoreNote(null)
    setError(null)
    try {
      const res = await fetch('/api/risk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setError(body.error || 'Risk scoring failed.')
      else {
        setScoreNote(`Scored ${body.scored}${body.skipped ? `, ${body.skipped} unchanged` : ''}.`)
        startTransition(() => router.refresh())
      }
    } catch {
      setError('Risk scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  const dragEnabled = !filtersOn && groupBy === 'none'

  const rowProps = {
    horizon, busy, editingKeys, edits, openFields, cancelRecord, stage,
    openId, setOpenId, dragId, overId, setDragId, setOverId, dropOn, dragEnabled,
    reorderMilestones, onFocus, focusOnly,
  }

  return (
    <div className={'px-8 py-9 mx-auto pb-24 ' + (view === 'graph' ? 'max-w-none' : 'max-w-[1440px]')}>
      {/* ── Header + view switch ── */}
      <div className="mb-5 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-tight text-[#181818] leading-tight">Portfolio Health</h1>
          <p className="mt-1.5 mb-0 text-[13.5px] text-[#3E3E3C]">
            Active projects only{manual ? '. Drag to set this week’s order.' : ', ordered by what needs attention first.'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#D6DEE7] rounded-lg p-1">
          {(['table', 'graph', 'gantt'] as const).map(v => (
            <Link key={v} href={withParam('view', v)}
                  className={'px-3 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors ' +
                    (view === v ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')}>
              {v === 'table' ? 'Table' : v === 'graph' ? 'Graph' : 'Gantt'}
            </Link>
          ))}
        </div>
      </div>
      {/* ── One control row: horizon, filters, grouping, scoring, scope ──
          Previously three stacked rows. They are all "narrow what I am looking
          at", and splitting one job across three lines made the page open with
          a wall of chrome above any content. */}
      <div className="flex items-center gap-2 flex-wrap mb-3.5">
        <div className="flex items-center gap-1 bg-white border border-[#D6DEE7] rounded-lg p-[3px]">
          {HORIZONS.map(h => (
            <button key={h} type="button" onClick={() => setHorizon(h)} aria-pressed={horizon === h}
                    title={`Milestones landing in the ${HORIZON_HINT[h]}`}
                    className={'px-3 py-1 rounded-[5px] text-[11.5px] font-semibold transition-colors ' +
                      (horizon === h ? 'bg-[#2F3E50] text-white' : 'text-[#55677A] hover:bg-[#f8fafc]')}>
              {HORIZON_LABEL[h]}
            </button>
          ))}
        </div>

        <span className="w-px h-6 bg-[#E4EAF0] mx-0.5" />

        {/* Focus filter. Opening a row still shows an empty card rather than
            hiding the project, so the list of sites stays stable while you
            narrow to the week's work. */}
        <button
          type="button"
          onClick={() => setFocusOnly(v => !v)}
          aria-pressed={focusOnly}
          title="Show only milestones marked as this week's focus"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold border transition-colors"
          style={focusOnly
            ? { background: '#E6C87A', borderColor: '#C8963A', color: '#5E4511' }
            : { background: '#fff', borderColor: '#D6DEE7', color: '#55677A' }}
        >
          <Target size={12} />
          Focus only
        </button>

        <Select label="Workstream" value={filters.workstream}
                onChange={v => setFilters(f => ({ ...f, workstream: v as WorkstreamKey | 'all' }))}
                options={[['all', 'All Workstreams'], ...WORKSTREAMS.map(w => [w, WORKSTREAM_LABELS[w]] as [string, string])]} />
        <Select label="Project manager" value={filters.pm}
                onChange={v => setFilters(f => ({ ...f, pm: v }))}
                options={[['all', 'All Managers'], ...opts.pms.map(([id, name]) => [id, name] as [string, string])]} />
        <Select label="Tranche" value={filters.tranche}
                onChange={v => setFilters(f => ({ ...f, tranche: v }))}
                options={[['all', 'All Tranches'], ...opts.tranches.map(t => [t, t] as [string, string])]} />
        <Select label="Group by" value={groupBy}
                onChange={v => setGroupBy(v as GroupBy)}
                options={(Object.keys(GROUP_LABEL) as GroupBy[]).map(k => [k, GROUP_LABEL[k]] as [string, string])} />

        {(filtersOn || groupBy !== 'none') && (
          <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setGroupBy('none') }}
                  className="text-[11.5px] font-semibold text-[#2C5485] hover:underline">
            Clear
          </button>
        )}

        {/* Everything after this sits right, so the row reads as
            "narrow it down … | … here is what you are looking at". */}
        <span className="ml-auto flex items-center gap-2.5">
          {manual && (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#8A6519] bg-[#FDF0D5] border border-[#E6C87A] rounded-full px-2.5 py-1">
              <RotateCcw size={11} />
              Manual order
              <button type="button" onClick={resetOrder} disabled={busy}
                      className="underline font-bold hover:text-[#5E4511]">Reset</button>
            </span>
          )}
          <button
            type="button"
            onClick={rescoreRisk}
            disabled={scoring || busy}
            title={riskScored === 0
              ? 'Score delivery risk from weekly notes and threads. Sends that text to the Gemini API.'
              : 'Re-score risk. Projects whose notes and counts have not changed are skipped.'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11.5px] font-semibold border border-[#D6DEE7] bg-white text-[#55677A] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <Sparkles size={11} />
            {scoring ? 'Scoring…' : riskScored === 0 ? 'Score Risk' : 'Re-score'}
          </button>
          <span className="text-[12px] text-[#55677A] whitespace-nowrap">
            <strong className="tabular-nums text-[#181818] font-bold">{filtered.length}</strong>
            {filtered.length !== list.length && <span className="text-[#94a3b8]"> of {list.length}</span>} active
            {heldCount > 0 && <span className="text-[#94a3b8]"> · {heldCount} on hold</span>}
          </span>
        </span>
      </div>

      {scoreNote && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[12.5px] bg-[#F0FDF4] text-[#166534]">
          <Check size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1">{scoreNote}</span>
          <button type="button" onClick={() => setScoreNote(null)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[12.5px] bg-[#FEF2F2] text-[#991B1B]">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {!dragEnabled && manual && (
        <p className="m-0 mb-2 text-[11.5px] text-[#94a3b8]">
          Reordering is off while filtering or grouping — the visible list is a subset, so a drop position would not
          describe the rows you cannot see.
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e2e8f0] px-6 py-14 text-center">
          <p className="m-0 text-[13.5px] text-[#3E3E3C]">
            {list.length === 0 ? 'No active projects. Everything is on hold or archived.' : 'Nothing matches those filters.'}
          </p>
        </div>
      ) : view === 'graph' ? (
        <MomentumChart rows={filtered} expandable />
      ) : view === 'gantt' ? (
        <PriorityGantt rows={filtered} horizon={horizon} />
      ) : groups ? (
        <div className="flex flex-col gap-4">
          {groups.map(g => (
            <section key={g.key}>
              <h2 className="flex items-baseline gap-2 m-0 mb-1.5">
                <span className="text-[12.5px] font-bold text-[#181818]">{g.label}</span>
                <span className="text-[11px] tabular-nums text-[#94a3b8]">{g.rows.length}</span>
              </h2>
              <BoardTable rows={g.rows} {...rowProps} />
            </section>
          ))}
        </div>
      ) : (
        <BoardTable rows={filtered} {...rowProps} />
      )}

      <p className="mt-3 mb-0 mx-0.5 text-[11.5px] text-[#9AA7B4]">
        {view === 'table'
          ? 'Drag a row by its handle to set the order the team works this week. Click a pencil to edit a field; nothing saves until you press Save.'
          : 'Same rows, same order as the table. Hover a marker for its milestone and date.'}
      </p>

      {/* ── Lightning-style save bar ── */}
      {pendingCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E4EAF0] bg-white/95 backdrop-blur px-8 py-3
                        flex items-center justify-between gap-4 shadow-[0_-2px_10px_rgba(47,62,80,0.08)]">
          <span className="text-[12.5px] text-[#3E3E3C]">
            <strong className="tabular-nums">{pendingCount}</strong> unsaved change{pendingCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={cancelEdits} disabled={busy}
                    className="px-3.5 py-1.5 rounded-md text-[12.5px] font-semibold bg-white border border-[#DDDBDA] text-[#3E3E3C] hover:bg-[#f8fafc]">
              Cancel
            </button>
            <button type="button" onClick={saveEdits} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12.5px] font-semibold bg-[#70A0D0] text-white hover:bg-[#2C5485] disabled:opacity-50">
              <Check size={13} />{busy ? 'Saving…' : 'Save'}
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

// ── shared row props ──────────────────────────────────────────────────

interface RowShared {
  horizon: Horizon
  busy: boolean
  editingKeys: Set<EditKey>
  edits: Record<EditKey, PendingEdit>
  openFields: (keys: EditKey[]) => void
  cancelRecord: (keys: EditKey[]) => void
  stage: (k: EditKey, e: PendingEdit) => void
  openId: string | null
  setOpenId: (id: string | null) => void
  dragId: string | null
  overId: string | null
  setDragId: (id: string | null) => void
  setOverId: (id: string | null) => void
  dropOn: (id: string) => void
  dragEnabled: boolean
  reorderMilestones: (ids: string[]) => Promise<boolean>
  onFocus: (id: string, next: boolean) => Promise<boolean>
  focusOnly: boolean
}

function BoardTable({ rows, ...s }: { rows: PriorityRow[] } & RowShared) {
  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#FAFBFC] border-b border-[#E4EAF0]">
              <Th className="w-[54px] pl-3" />
              <Th className="w-[26px]" />
              <Th>Project</Th>
              <Th>Stage</Th>
              <Th>Momentum</Th>
              <Th>Risk</Th>
              <Th>Phase</Th>
              <Th align="right">Target</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <BoardRow key={r.projectId} row={r} index={i} {...s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BoardRow({ row, index, ...s }: { row: PriorityRow; index: number } & RowShared) {
  const m = row.current
  const open = s.openId === row.projectId
  const isOver = s.overId === row.projectId && s.dragId !== row.projectId
  const stageKey = `project:${row.projectId}:stage`
  // Target belongs to the current milestone, not the project, but it is on this
  // row so the record pencil opens it too — the pencil edits what you can see.
  const targetKey = m ? `milestone:${m.id}:end_date` : null

  /**
   * ONE edit control per project, covering everything that project shows.
   *
   * Every milestone row used to carry its own pencil, which put seven of them
   * in a single open card and made "edit" a hunt rather than an action. This
   * opens the row's own fields plus every milestone in the current horizon, so
   * one click makes the whole record editable and Save closes all of it.
   *
   * Milestones hidden by the Not Started toggle are included deliberately: they
   * render as inputs the moment they are revealed, rather than being stuck
   * read-only inside an otherwise-editable card.
   */
  const recordKeys = [
    stageKey,
    ...(targetKey ? [targetKey] : []),
    ...row.cardMilestones
      .filter(x => inHorizon(x.milestone, s.horizon))
      .flatMap(x => [`milestone:${x.milestone.id}:status`, `milestone:${x.milestone.id}:end_date`]),
  ]
  const rowEditing = recordKeys.some(k => s.editingKeys.has(k))

  return (
    <>
      <tr
        draggable={s.dragEnabled && !rowEditing}
        onDragStart={() => s.setDragId(row.projectId)}
        onDragEnter={() => s.setOverId(row.projectId)}
        onDragOver={e => e.preventDefault()}
        onDrop={() => s.dropOn(row.projectId)}
        className="group border-b border-[#F1F5F9] hover:bg-[#fafbfc] transition-colors"
        style={{
          background: open ? '#FFFBF5' : row.health === 'delayed' ? '#FFFBF5' : undefined,
          boxShadow: isOver ? 'inset 0 2px 0 #C8963A' : undefined,
          opacity: s.dragId === row.projectId ? 0.4 : 1,
        }}
      >
        <td className="py-2.5 pl-3 align-middle">
          <span className="inline-flex items-center gap-1.5">
            <GripVertical size={13} className={s.dragEnabled ? 'text-[#C6D0DA] cursor-grab' : 'text-[#EDF1F5]'} />
            <span className="text-[11px] font-bold text-[#A9B5C1] w-[16px] text-right tabular-nums">{index + 1}</span>
          </span>
        </td>
        <td className="py-2.5 align-middle">
          <button type="button" onClick={() => s.setOpenId(open ? null : row.projectId)}
                  aria-label={open ? 'Collapse' : 'Expand'} aria-expanded={open}
                  className="flex items-center text-[#8A6519]">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} className="text-[#C6D0DA]" />}
          </button>
        </td>
        <Td>
          <span className="inline-flex items-center gap-2">
            {row.health && (
              <i className="block w-[7px] h-[7px] rounded-full shrink-0"
                 style={{ background: HEALTH_DOT[row.health] }} title={HEALTH_LABEL[row.health]} />
            )}
            <Link href={`/projects/${row.projectId}`}
                  className="text-[13px] font-semibold text-[#181818] hover:text-[#2C5485] hover:underline">
              {row.name}
            </Link>
            {/* Record-level edit: opens every editable field on this row at
                once, rather than making you find each pencil in turn. */}
            <button
              type="button"
              onClick={() => rowEditing ? s.cancelRecord(recordKeys) : s.openFields(recordKeys)}
              aria-label={rowEditing ? `Stop editing ${row.name}` : `Edit ${row.name}`}
              title={rowEditing
                ? 'Editing this project — Save or Cancel below'
                : 'Edit this project and its milestones'}
              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors"
              style={rowEditing
                ? { background: '#FDF0D5', borderColor: '#E6C87A', color: '#8A6519' }
                : { background: 'transparent', borderColor: 'transparent', color: '#C6D0DA' }}
            >
              <Pencil size={11} />
              {rowEditing && <span className="text-[10px] font-bold">Editing</span>}
            </button>
          </span>
        </Td>
        <Td>
          <EditableField editing={s.editingKeys.has(stageKey)} display={row.stage}>
            <select
              autoFocus
              value={(s.edits[stageKey]?.value as string) ?? row.stage}
              disabled={s.busy}
              onChange={e => s.stage(stageKey, {
                kind: 'project', id: row.projectId, field: 'stage', value: e.target.value,
              })}
              title="Setting On Hold removes this project from the board once saved."
              className="px-2 py-1 rounded-md text-[11.5px] font-semibold border border-[#C8963A] bg-white text-[#3E3E3C]"
            >
              {SELECTABLE_STAGES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </EditableField>
        </Td>
        <Td>
          {row.momentum ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                background: BAND_COLOR[row.momentum.band].bg,
                color: BAND_COLOR[row.momentum.band].fg,
              }}
              title={momentumSummary(row.momentum)}
            >
              {BAND_LABEL[row.momentum.band]}
              <span className="tabular-nums opacity-70">{row.momentum.score}</span>
            </span>
          ) : <span className="text-[#C6D0DA]">—</span>}
        </Td>
        <Td>
          {row.risk ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                background: RISK_BAND_COLOR[row.risk.band].bg,
                color: RISK_BAND_COLOR[row.risk.band].fg,
              }}
              title={[
                row.risk.summary,
                row.risk.drivers.length ? `Drivers: ${row.risk.drivers.join(' · ')}` : '',
                `Scored ${formatShortDate(row.risk.scoredAt)}`,
              ].filter(Boolean).join('\n')}
            >
              {RISK_BAND_LABEL[row.risk.band]}
              <span className="tabular-nums opacity-70">{row.risk.score}</span>
            </span>
          ) : <span className="text-[#C6D0DA]" title="Not scored yet">—</span>}
        </Td>
        <Td>
          {row.phaseLabel && row.phaseWorkstream
            ? <MajorPill label={row.phaseLabel} workstream={row.phaseWorkstream} />
            : <span className="text-[#C6D0DA]">—</span>}
        </Td>
        <Td align="right" className="tabular-nums">
          {targetKey && s.editingKeys.has(targetKey) ? (
            <input
              type="date"
              value={(s.edits[targetKey]?.value as string) ?? m?.end_date ?? ''}
              disabled={s.busy}
              onChange={e => s.stage(targetKey, {
                kind: 'milestone', id: m!.id, field: 'end_date', value: e.target.value,
              })}
              className="w-[116px] px-1.5 py-0.5 rounded text-[11px] text-[#181818] border border-[#C8963A] bg-white outline-none"
            />
          ) : m?.end_date ? formatShortDate(m.end_date) : <span className="text-[#C6D0DA]">—</span>}
        </Td>
      </tr>

      {open && (
        <tr className="border-b border-[#F1F5F9]" style={{ background: '#FFFBF5' }}>
          <td /><td />
          <td colSpan={6} className="px-3.5 pb-4 pt-0">
            <ProjectPlan row={row} {...s} />
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * A field that swaps between its read-only text and its control.
 *
 * It owns no pencil of its own: the project row's single edit control decides
 * when this opens, which is what keeps one card from sprouting a pencil per
 * field.
 */
function EditableField({
  editing, display, children,
}: {
  editing: boolean
  display: React.ReactNode
  children: React.ReactNode
}) {
  return editing ? <>{children}</> : <>{display}</>
}

// ── expanded card ─────────────────────────────────────────────────────

/**
 * The project's plan as ONE flat, single-column list.
 *
 * Deliberately not grouped into per-discipline columns any more. Grouping made
 * the card read as three separate lists that happened to share a box, and it
 * made the one thing this card is for — putting the week's work in the order
 * you intend to do it — impossible, because you cannot drag across columns.
 * Flat and single-column, the major each item belongs to becomes a label on the
 * row rather than a heading above it, and the whole plan is one orderable list.
 */
function ProjectPlan({ row, ...s }: { row: PriorityRow } & RowShared) {
  // Not Started is hidden by default. The card exists to run a weekly meeting,
  // and work nobody has begun is the bulk of any plan — showing it buries the
  // handful of things actually in flight. The toggle says how many are hidden
  // rather than hiding the fact that anything is.
  const [showNotStarted, setShowNotStarted] = useState(false)

  const inWindow = row.cardMilestones.filter(x => inHorizon(x.milestone, s.horizon))
  const notStartedCount = inWindow.filter(x => x.milestone.status === 'not_started').length
  const focusCount = inWindow.filter(x => x.focus).length

  const afterStatus = showNotStarted ? inWindow : inWindow.filter(x => x.milestone.status !== 'not_started')
  // The focus filter is board-wide, so a project with nothing focused collapses
  // to an empty card rather than disappearing — the row still says the project
  // exists and simply has nothing in this week's list.
  const visible = s.focusOnly ? afterStatus.filter(x => x.focus) : afterStatus

  // Focus first once anything is marked, due date otherwise. Stated in the
  // header so the reader always knows which list they are looking at.
  const anyFocus = visible.some(x => x.focus)
  const ordered = [...visible].sort(anyFocus ? byFocus : byDueDate)

  if (!inWindow.length) {
    return (
      <div className="rounded-lg bg-white border border-[#EDF1F5] px-4 py-5 text-center">
        <p className="m-0 text-[12.5px] text-[#706E6B]">
          {row.cardMilestones.length === 0
            ? 'No milestones on this project yet.'
            : `Nothing lands in the ${HORIZON_HINT[s.horizon]}. Widen the horizon to see the rest of the plan.`}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white border border-[#EDF1F5]">
      <div className="flex items-center justify-between gap-3 px-4 py-1.5 border-b border-[#F1F5F9]">
        <span className="text-[10.5px] text-[#94a3b8]">
          {anyFocus ? 'Focus first, then due date' : 'Ordered by due date'}
          {focusCount > 0 && ` · ${focusCount} in focus`}
        </span>
        {notStartedCount > 0 && (
          <button type="button" onClick={() => setShowNotStarted(v => !v)}
                  className="text-[11px] font-semibold text-[#2C5485] hover:underline">
            {showNotStarted ? 'Hide' : 'Show'} {notStartedCount} Not Started
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#F1F5F9] bg-[#FAFBFC]">
        <span className="w-[30px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Focus</span>
        <span className="flex-1 min-w-0 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Milestone</span>
        <span className="w-[186px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Major Milestone</span>
        <span className="w-[150px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Team</span>
        <span className="w-[70px] text-center text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Critical</span>
        <span className="w-[96px] text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Status</span>
        <span className="w-[108px] text-right text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#94a3b8]">Due</span>
      </div>

      <ul className="list-none m-0 p-0">
        {ordered.map(item => (
          <SubMilestone key={item.milestone.id} item={item} projectId={row.projectId} {...s} />
        ))}
      </ul>

      {ordered.length === 0 && (
        <p className="m-0 px-4 py-4 text-center text-[12px] text-[#94a3b8]">
          Everything in this window is Not Started.
        </p>
      )}
    </div>
  )
}

/** One sub-milestone: focus checkbox, name, major, team, critical, status, due. */
function SubMilestone({
  item, projectId, ...s
}: { item: CardMilestone; projectId: string } & RowShared) {
  const { milestone, majorLabel, majorKey, workstream, teams, focus, comments } = item
  const [threadOpen, setThreadOpen] = useState(false)
  const statusKey = `milestone:${milestone.id}:status`
  const dateKey = `milestone:${milestone.id}:end_date`
  const slipped = milestone.end_date && milestone.baseline_date
    && milestone.end_date.slice(0, 10) > milestone.baseline_date.slice(0, 10)

  // Deep-link straight to this milestone's major on the project's Workstreams
  // tab, rather than dumping the reader on the tab to find it themselves.
  const href = `/projects/${projectId}?tab=workstreams&ws=${workstream}&major=${encodeURIComponent(majorKey)}`

  return (
    <>
      <li
        className="group/ms flex items-center gap-3 px-4 py-[7px] border-b border-[#F8FAFC] last:border-0 transition-colors"
        style={focus
          // Focused rows carry a gold left edge and a warm tint. The tint alone
          // was too quiet to scan for; the edge is what makes the week's list
          // findable in a long card.
          ? { background: '#FFFDF6', boxShadow: 'inset 3px 0 0 #E6C87A' }
          : undefined}
      >
        <span className="w-[30px] shrink-0">
          <FocusCheckbox
            milestoneId={milestone.id}
            checked={focus}
            busy={s.busy}
            onToggle={s.onFocus}
          />
        </span>

        {/* No pencil here. Editing is opened once for the whole project from the
            row above; a pencil per milestone put seven of them in one card. */}
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <Link href={href}
                className="min-w-0 truncate text-[12.5px] text-[#181818] hover:text-[#2C5485] hover:underline"
                title={`${milestone.label} — open in Workstreams`}>
            {milestone.label}
          </Link>
          {/* The thread is where the instructions live, so the count is a
              deliberate affordance rather than a badge: zero still shows on
              hover, because "add context" needs a way in. */}
          <button
            type="button"
            onClick={() => setThreadOpen(o => !o)}
            aria-expanded={threadOpen}
            title={comments > 0 ? `${comments} comment${comments === 1 ? '' : 's'}` : 'Add context'}
            className={'shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors ' +
              (comments > 0
                ? 'text-[#55677A] bg-[#F4F6F8] border border-[#E4EAF0]'
                : 'text-[#C6D0DA] opacity-0 group-hover/ms:opacity-100 focus:opacity-100')}
          >
            <MessageSquare size={10} />
            {comments > 0 && <span className="tabular-nums">{comments}</span>}
          </button>
        </span>

        <span className="w-[186px] shrink-0 min-w-0">
          <MajorPill label={majorLabel} workstream={workstream} />
        </span>

        <span className="w-[150px] shrink-0 min-w-0 flex items-center gap-1">
          {teams.length === 0
            ? <span className="text-[#C6D0DA] text-[11px]">—</span>
            : teams.slice(0, 2).map(t => (
                <span key={t}
                      className="inline-block max-w-[70px] truncate px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                                 bg-[#F4F6F8] border border-[#E4EAF0] text-[#55677A]"
                      title={teams.join(' · ')}>
                  {t}
                </span>
              ))}
          {teams.length > 2 && (
            <span className="text-[10px] text-[#94a3b8] shrink-0" title={teams.join(' · ')}>
              +{teams.length - 2}
            </span>
          )}
        </span>

        <span className="w-[70px] shrink-0 text-center">
          {milestone.is_critical
            ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-[0.05em]
                               bg-[#F3EEFC] text-[#5B21B6] border border-[#DDD0F2]">
                Critical
              </span>
            : <span className="text-[#D7E0E8]">—</span>}
        </span>

        <span className="w-[96px] shrink-0">
          {s.editingKeys.has(statusKey) ? (
            <select
              value={(s.edits[statusKey]?.value as string) ?? milestone.status}
              disabled={s.busy}
              onChange={e => s.stage(statusKey, {
                kind: 'milestone', id: milestone.id, field: 'status', value: e.target.value,
              })}
              className="w-full px-1 py-0.5 rounded text-[10.5px] font-semibold border border-[#C8963A] bg-white"
            >
              {STATUSES.map(k => <option key={k} value={k}>{STATUS_STYLE[k].label}</option>)}
            </select>
          ) : (
            <StatusPill status={milestone.status} />
          )}
        </span>

        <span className="w-[108px] shrink-0 text-right">
          {s.editingKeys.has(dateKey) ? (
            <input
              type="date"
              value={(s.edits[dateKey]?.value as string) ?? milestone.end_date ?? ''}
              disabled={s.busy}
              onChange={e => s.stage(dateKey, {
                kind: 'milestone', id: milestone.id, field: 'end_date', value: e.target.value,
              })}
              className="w-[104px] px-1 py-0.5 rounded text-[10.5px] text-[#181818] border border-[#C8963A] bg-white outline-none"
            />
          ) : (
            <DatePill date={milestone.end_date} slipped={!!slipped} baseline={milestone.baseline_date} />
          )}
        </span>
      </li>

      {threadOpen && (
        <li className="px-4 py-3 border-b border-[#F8FAFC] bg-[#FCFDFE]">
          <CommentThread milestoneId={milestone.id} label={milestone.label} />
        </li>
      )}
    </>
  )
}

/**
 * Mark a milestone as this week's focus.
 *
 * A checkbox rather than a vote tally: the question in a delivery meeting is
 * "are we doing this", which is binary and decided out loud. A count answers
 * "how much do we collectively want it", which nobody asks.
 */
function FocusCheckbox({
  milestoneId, checked, busy, onToggle,
}: {
  milestoneId: string
  checked: boolean
  busy: boolean
  onToggle: (id: string, next: boolean) => Promise<boolean>
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={busy}
      onClick={() => onToggle(milestoneId, !checked)}
      title={checked ? 'Remove from this week’s focus' : 'Mark as this week’s focus'}
      className="w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center transition-colors disabled:opacity-50"
      style={checked
        ? { background: '#E6C87A', borderColor: '#C8963A', color: '#5E4511' }
        : { background: '#fff', borderColor: '#D6DEE7' }}
    >
      {checked && <Check size={12} strokeWidth={3} />}
    </button>
  )
}


// ── gantt ─────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LANE_LABEL_PX = 210

function PriorityGantt({ rows, horizon }: { rows: PriorityRow[]; horizon: Horizon }) {
  const span = HORIZON_GANTT_MONTHS[horizon]
  const now = new Date()
  const originY = now.getUTCFullYear()
  const originM = now.getUTCMonth()
  const months = Array.from({ length: span }, (_, i) => {
    const k = originM + i
    return { y: originY + Math.floor(k / 12), m: ((k % 12) + 12) % 12 }
  })

  function fraction(iso: string): number | null {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
    const idx = (y - originY) * 12 + (m - 1) - originM
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const f = (idx + (d - 1) / dim) / span
    return f >= 0 && f <= 1 ? f : null
  }

  const colPx = span > 3 ? 56 : 120
  const cols = `${LANE_LABEL_PX}px repeat(${span}, minmax(${colPx}px, 1fr))`

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] px-4 pt-3.5 pb-3">
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: LANE_LABEL_PX + span * colPx }}>
          <div className="grid border-b border-[#E4EAF0]" style={{ gridTemplateColumns: cols }}>
            <span />
            {months.map((mo, i) => (
              <span key={`${mo.y}-${mo.m}`} className="flex items-baseline gap-1 pb-1.5 pl-2"
                    style={{ borderLeft: i === 0 ? undefined : '1px solid #F0F4F8' }}>
                <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-[#6E7E8E]">{MONTHS[mo.m]}</span>
                {(mo.m === 0 || i === 0) && <span className="text-[8.5px] text-[#A9B5C1]">&apos;{String(mo.y).slice(2)}</span>}
              </span>
            ))}
          </div>

          {rows.map((r, i) => {
            const marks = r.groups.flatMap(g => g.milestones)
              .filter(m => m.status !== 'complete' && m.end_date && fraction(m.end_date) !== null)
            return (
              <div key={r.projectId} className="grid items-center relative border-b border-[#F4F7FA] last:border-0"
                   style={{ gridTemplateColumns: cols, minHeight: 36, background: r.health === 'delayed' ? '#FFFBF5' : undefined }}>
                <span className="flex items-center gap-2 pl-3 pr-2.5">
                  <span className="text-[11px] font-bold text-[#A9B5C1] w-[16px] tabular-nums">{i + 1}</span>
                  {r.health && <i className="block w-[7px] h-[7px] rounded-full shrink-0" style={{ background: HEALTH_DOT[r.health] }} />}
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
                  <span key={m.id}
                        title={`${m.label} · ${formatShortDate(m.end_date)} · ${STATUS_STYLE[m.status].label}`}
                        className="absolute top-1/2 w-[9px] h-[9px] -ml-[4.5px] -mt-[4.5px] rotate-45"
                        style={{
                          left: `calc(${LANE_LABEL_PX}px + (100% - ${LANE_LABEL_PX}px) * ${fraction(m.end_date as string)})`,
                          background: m.is_critical ? '#5B21B6' : m.status === 'blocked' ? '#92400E' : '#E6C87A',
                          opacity: m.status === 'not_started' && !m.is_critical ? 0.5 : 1,
                          zIndex: 2,
                        }} />
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

// ── primitives ────────────────────────────────────────────────────────

function Select({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className="px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-[#D6DEE7] bg-white text-[#3E3E3C] cursor-pointer hover:bg-[#f8fafc]"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )
}

/**
 * A major milestone as a pill, tinted by its discipline.
 *
 * Replaces the thin colour bar that used to sit beside the name: the bar was a
 * second element competing for a cramped cell, and the tint carries the same
 * information with none of the extra geometry.
 */
function MajorPill({ label, workstream }: { label: string; workstream: WorkstreamKey }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full text-[10.5px] font-semibold
                 bg-[#F4F6F8] border border-[#E4EAF0] text-[#55677A]"
      title={`${WORKSTREAM_LABELS[workstream]} · ${label}`}
    >
      <i className="block w-[5px] h-[5px] rounded-full shrink-0" style={{ background: LANE_HUE[workstream] }} />
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Status as a fixed-width pill, so the column reads as one straight edge. */
function StatusPill({ status }: { status: MilestoneStatus }) {
  const st = STATUS_STYLE[status]
  return (
    <span
      className="inline-block w-[68px] text-center px-1 py-0.5 rounded-full text-[10px] font-semibold border truncate"
      style={{ background: st.bg, borderColor: st.border, color: st.text }}
      title={st.label}
    >
      {st.label}
    </span>
  )
}

/**
 * Due date as a pill. Neutral normally; red when the target has moved past its
 * baseline.
 *
 * This replaces a separate "SLIP" tag sitting beside the date. Two elements
 * were saying one thing — that the date has moved — and the date is the thing
 * that moved, so it should be what turns red.
 */
function DatePill({ date, slipped, baseline }: {
  date: string | null
  slipped: boolean
  baseline: string | null
}) {
  if (!date) {
    return (
      <span className="inline-block w-[74px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold
                       bg-[#F8FAFC] border border-[#EDF1F5] text-[#C6D0DA]">
        No date
      </span>
    )
  }
  return (
    <span
      className="inline-block w-[74px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums border"
      style={slipped
        ? { background: '#FEF2F2', borderColor: '#F0B4B4', color: '#b91c1c' }
        : { background: '#F4F6F8', borderColor: '#E4EAF0', color: '#3E3E3C' }}
      title={slipped && baseline
        ? `Slipped from its baseline of ${formatDate(baseline)} — the baseline is admin-locked`
        : formatDate(date)}
    >
      {formatShortDate(date)}
    </span>
  )
}

function Th({ children, align = 'left', className = '' }: {
  children?: React.ReactNode; align?: 'left' | 'right'; className?: string
}) {
  return (
    <th className={`px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-[0.07em] text-[#706E6B] ${className}`}
        style={{ textAlign: align }}>{children}</th>
  )
}

function Td({ children, align = 'left', className = '', style }: {
  children?: React.ReactNode; align?: 'left' | 'right'; className?: string; style?: React.CSSProperties
}) {
  return (
    <td className={`px-3.5 py-2.5 text-[12.5px] text-[#3E3E3C] align-middle ${className}`}
        style={{ textAlign: align, ...style }}>{children}</td>
  )
}
