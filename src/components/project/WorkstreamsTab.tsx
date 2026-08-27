'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MoreVertical, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react'
import { formatDate, formatShortDate } from '@/lib/utils'
import { WorkstreamPlan } from './WorkstreamPlan'
import { WorkstreamOverview } from './WorkstreamOverview'
import { Celebrate } from '@/components/ui/Celebrate'
import {
  WORKSTREAMS, WORKSTREAM_LABELS, majorsFor, rollUpMajor, dateConflicts, focusMajor,
  type WorkstreamKey, type MajorDef, type MajorState, type Milestone,
  type MilestoneDep, type Gate, type MajorRollup, type LinkedTask,
  type WorkstreamActivity, type GateLink,
} from '@/lib/workstreams'
import { varianceLabel, HEALTH_LABEL, type ScheduleHealth } from '@/lib/workstreams'

interface AppUser { id: string; full_name: string; avatar_url?: string | null }
interface Update {
  id: string; body: string; created_at: string
  created_by: string | null; major_key: string | null; workstream: string
}

type View = 'overview' | WorkstreamKey

const DOT: Record<MajorStatusKey, { border: string; fill: string; halo?: string }> = {
  upcoming: { border: '#CBD5DF', fill: '#CBD5DF' },
  complete: { border: '#22A45D', fill: '#22A45D' },
  active:   { border: '#C8963A', fill: '#C8963A', halo: 'rgba(230,200,122,.30)' },
  at_risk:  { border: '#F59E0B', fill: '#F59E0B', halo: 'rgba(245,158,11,.22)' },
}

const BAR: Record<MajorStatusKey, string> = {
  upcoming: '#CBD5DF',
  complete: '#22A45D',
  active:   '#C8963A',
  at_risk:  '#F59E0B',
}

type MajorStatusKey = MajorRollup['status']

// The schedule traffic light. Semantic colour, deliberately separate from the
// gold "active" accent so a healthy schedule never competes with the brand hue.
const HEALTH_STYLE: Record<ScheduleHealth, { bg: string; fg: string; dot: string }> = {
  on_track: { bg: '#F0FDF4', fg: '#166534', dot: '#22A45D' },
  at_risk:  { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B' },
  delayed:  { bg: '#FEF2F2', fg: '#991B1B', dot: '#EF4444' },
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
}

export function WorkstreamsTab({
  projectId, projectName, defs, majorState, gates, gateLinks, milestones, deps,
  updates, tasks, activity, users, isAdmin,
}: {
  projectId: string
  projectName: string
  defs: MajorDef[]
  majorState: MajorState[]
  gates: Gate[]
  gateLinks: GateLink[]
  milestones: Milestone[]
  deps: MilestoneDep[]
  updates: Update[]
  tasks: LinkedTask[]
  activity: WorkstreamActivity[]
  users: AppUser[]
  isAdmin: boolean
}) {
  const [view, setView] = useState<View>('overview')

  // `null` means "not touched yet" → default to the major a PM most likely
  // wants. `''` means the user deliberately collapsed everything.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [celebrating, setCelebrating] = useState<string | null>(null)

  const conflicts = useMemo(() => dateConflicts(milestones, deps), [milestones, deps])

  const majorLabelOf = useMemo(() => {
    const byKey = new Map(defs.map(d => [d.key, d.label]))
    return (key: string) => byKey.get(key) ?? key
  }, [defs])

  const stateByKey = useMemo(
    () => new Map(majorState.map(s => [s.major_key, s])),
    [majorState],
  )

  const rollupsByWs = useMemo(() => {
    const out = {} as Record<WorkstreamKey, MajorRollup[]>
    for (const ws of WORKSTREAMS) {
      out[ws] = majorsFor(defs, ws).map(d =>
        rollUpMajor(d, milestones, conflicts, stateByKey.get(d.key)?.completed_at ?? null))
    }
    return out
  }, [defs, milestones, conflicts, stateByKey])

  // Fire the celebration when a major first reads as complete and has never
  // been celebrated. The marker is persisted so it never replays on reload.
  const celebratedRef = useRef(false)
  useEffect(() => {
    if (celebratedRef.current || celebrating) return
    const all = WORKSTREAMS.flatMap(ws => rollupsByWs[ws])
    const fresh = all.find(r =>
      r.status === 'complete' && r.milestoneCount > 0 && !stateByKey.get(r.key)?.celebrated_at)
    if (!fresh) return

    celebratedRef.current = true
    setCelebrating(fresh.key)
    fetch('/api/workstreams/majors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, major_key: fresh.key, celebrated: true }),
    }).catch(() => { /* the animation already played; a failed marker just means it may replay */ })
  }, [rollupsByWs, stateByKey, celebrating, projectId])

  const isOverview = view === 'overview'
  const rollups = isOverview ? [] : rollupsByWs[view]
  const focus = isOverview ? undefined : focusMajor(rollups)
  const shownKey = openKey === null ? focus?.key ?? '' : openKey

  const totals = useMemo(() => {
    const all = WORKSTREAMS.flatMap(ws => rollupsByWs[ws])
    const majorOf = new Map(milestones.map(m => [m.id, m.major_key]))
    const wsOf = new Map(defs.map(d => [d.key, d.workstream]))
    const crossing = deps.filter(d => {
      const a = majorOf.get(d.milestone_id)
      const b = majorOf.get(d.depends_on)
      return a && b && wsOf.get(a) !== wsOf.get(b)
    }).length
    return { majors: all.length, deps: deps.length, crossing }
  }, [rollupsByWs, deps, milestones, defs])

  async function patchMajor(majorKey: string, patch: Record<string, unknown>) {
    await fetch('/api/workstreams/majors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, major_key: majorKey, ...patch }),
    })
    window.location.reload()
  }

  const setOwner = (majorKey: string, field: 'owner_id' | 'co_owner_id', value: string) =>
    patchMajor(majorKey, { [field]: value || null })

  async function setComplete(r: MajorRollup, complete: boolean) {
    if (complete) {
      const open = r.milestoneCount - r.doneCount
      const warn = open > 0
        ? `\n\n${open} milestone${open > 1 ? 's are' : ' is'} still open underneath it. They stay open — this only closes out the major milestone.`
        : ''
      if (!window.confirm(`Mark "${r.label}" complete?${warn}`)) return
    }
    await patchMajor(r.key, { completed: complete })
  }

  return (
    <div className="relative">
      {celebrating && (
        <Celebrate
          label={`${defs.find(d => d.key === celebrating)?.label ?? 'Major milestone'} complete`}
          onDone={() => setCelebrating(null)}
        />
      )}

      {/* ── header: title + workstream selector ── */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-4">
        <div>
          <h3 className="m-0 text-[15px] font-bold tracking-tight text-[#181818]">
            {isOverview ? 'Overview' : WORKSTREAM_LABELS[view]}
          </h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-[#706E6B]">
            {isOverview
              ? `${WORKSTREAMS.length} workstreams · ${totals.majors} major milestones · ${totals.deps} dependencies, ${totals.crossing} crossing workstreams`
              : summarise(rollups)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="ws-select" className="text-[10px] uppercase tracking-[0.11em] text-[#706E6B]">
            Workstream
          </label>
          <select
            id="ws-select"
            value={view}
            onChange={e => { setView(e.target.value as View); setOpenKey(null) }}
            className="text-[13px] font-semibold text-[#2F3E50] px-2.5 py-1.5 border border-[#C9D4DF] rounded bg-white cursor-pointer"
          >
            <option value="overview">Overview</option>
            {WORKSTREAMS.map(ws => (
              <option key={ws} value={ws}>{WORKSTREAM_LABELS[ws]}</option>
            ))}
          </select>
        </div>
      </div>

      {isOverview ? (
        <WorkstreamOverview
          defs={defs}
          milestones={milestones}
          deps={deps}
          rollupsByWs={rollupsByWs}
          onPick={key => {
            const def = defs.find(d => d.key === key)
            if (!def) return
            setView(def.workstream)
            setOpenKey(key)
          }}
        />
      ) : (
        <ul className="relative m-0 p-0 list-none">
          {/* the spine itself — inset to sit under the dot centres */}
          <span aria-hidden className="absolute w-px bg-[#E1E8EF]" style={{ left: 7, top: 14, bottom: 14 }} />

          {rollups.map(r => {
            const open = shownKey === r.key
            const dot = DOT[r.status]
            const state = stateByKey.get(r.key)
            const owner = state?.owner_id ? users.find(u => u.id === state.owner_id) : undefined
            const coOwner = state?.co_owner_id ? users.find(u => u.id === state.co_owner_id) : undefined

            return (
              <li key={r.key} data-entity-id={r.key} className="relative pl-[30px]">
                <span
                  aria-hidden
                  className="absolute grid place-items-center rounded-full bg-white"
                  style={{
                    left: 0, top: 15, width: 16, height: 16,
                    border: `2px solid ${dot.border}`,
                    boxShadow: dot.halo ? `0 0 0 4px ${dot.halo}` : undefined,
                  }}
                >
                  <span className="rounded-full" style={{ width: 6, height: 6, background: dot.fill }} />
                </span>

                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? '' : r.key)}
                  className="w-full grid items-center text-left rounded px-3 py-2.5 transition-colors"
                  style={{
                    gridTemplateColumns: 'minmax(0,1fr) auto',
                    gap: '4px 16px',
                    background: open ? '#F7FAFC' : 'transparent',
                    border: `1px solid ${open ? '#DCE4EC' : 'transparent'}`,
                  }}
                >
                  <span className="flex items-center gap-2 flex-wrap min-w-0">
                    <b
                      className="text-[14px] tracking-[-0.005em]"
                      style={{
                        fontWeight: r.status === 'upcoming' ? 500 : 600,
                        color: r.status === 'upcoming' ? '#7B8794' : r.status === 'complete' ? '#4C5A67' : '#181818',
                      }}
                    >
                      {r.label}
                    </b>

                    {r.status === 'complete' && <Tag bg="#F0FDF4" fg="#166534">Complete</Tag>}

                    {/* Schedule traffic light. Only shown once dates exist —
                        an undated major is not "on track", it is unplanned. */}
                    {r.health && r.status !== 'complete' && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ background: HEALTH_STYLE[r.health].bg, color: HEALTH_STYLE[r.health].fg }}
                      >
                        <span
                          aria-hidden
                          className="rounded-full"
                          style={{ width: 6, height: 6, background: HEALTH_STYLE[r.health].dot }}
                        />
                        {HEALTH_LABEL[r.health]}
                      </span>
                    )}

                    {r.manuallyCompleted && r.openUnderOverride > 0 && (
                      <Tag bg="#FEF3C7" fg="#92400E">
                        Closed With {r.openUnderOverride} Open
                      </Tag>
                    )}
                    {r.hasCritical && <Tag bg="#F5F3FF" fg="#5B21B6">⚡ Critical path</Tag>}
                    {r.hasDateConflict && <Tag bg="#FEF2F2" fg="#991B1B">Date conflict</Tag>}
                    {r.milestoneCount === 0 && <Tag bg="#EDF2F7" fg="#64748B">Not Planned</Tag>}
                  </span>

                  {/* One size across all three, so the row reads as a set. Weight and
                      colour carry the hierarchy instead: target solid, baseline
                      muted, variance coloured by health. Mixed sizes made this
                      look like three unrelated things. */}
                  <span className="flex items-end gap-5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <Stat label="Target">{formatShortDate(r.end)}</Stat>
                    <Stat label="Baseline" secondary>{formatShortDate(r.baseline)}</Stat>
                    <Stat
                      label="Variance"
                      color={r.health ? HEALTH_STYLE[r.health].fg : undefined}
                      title={varianceHint(r)}
                    >
                      {varianceLabel(r.variance) ?? '—'}
                    </Stat>
                  </span>

                  {/* progress bar — always present, so the row height never jumps */}
                  <span className="col-span-2 flex items-center gap-2.5">
                    <span className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: '#E7EDF3' }}>
                      <span
                        className="block h-full rounded-full transition-all"
                        style={{ width: `${r.pct}%`, background: BAR[r.status] }}
                      />
                    </span>
                    <span
                      className="text-[11px] font-semibold shrink-0"
                      style={{ color: r.status === 'complete' ? '#166534' : '#55677A', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {r.pct}%
                    </span>
                    <span className="flex items-center gap-1 text-[10.5px] text-[#9AA7B4] shrink-0">
                      {r.milestoneCount === 0
                        ? 'no milestones'
                        : `${r.doneCount}/${r.milestoneCount}${r.weighted ? ' · weighted' : ''}`}
                      {r.milestoneCount > 0 && (
                        <span
                          role="img"
                          aria-label="How this percentage is calculated"
                          title={r.weighted
                            ? `Weighted: each milestone contributes its own share of this major milestone, not an equal slice. ${r.doneCount} of ${r.milestoneCount} complete carries ${r.pct}% because the weights differ (they total ${r.weightTotal}%).`
                            : `No weights are set, so every milestone counts equally: ${r.doneCount} of ${r.milestoneCount} complete is ${r.pct}%. Give milestones a weight to reflect that some are bigger than others.`}
                          className="grid place-items-center rounded-full cursor-help"
                          style={{
                            width: 12, height: 12, fontSize: 8.5, fontWeight: 700,
                            fontStyle: 'italic', border: '1px solid #C6D0DA', color: '#7B8794',
                          }}
                        >
                          i
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                {/* ownership sits under the title: the author + co-author of this section */}
                <div className="flex items-center gap-2 flex-wrap pl-3 pb-1 -mt-0.5">
                  <OwnerPicker
                    label="Owner" value={state?.owner_id ?? ''} user={owner} users={users}
                    onChange={v => setOwner(r.key, 'owner_id', v)}
                  />
                  <OwnerPicker
                    label="Co-owner" value={state?.co_owner_id ?? ''} user={coOwner}
                    users={users.filter(u => u.id !== state?.owner_id)}
                    onChange={v => setOwner(r.key, 'co_owner_id', v)}
                  />
                  <MajorMenu rollup={r} onComplete={setComplete} />
                </div>

                {open && (
                  <div className="pl-3">
                    <WorkstreamPlan
                      projectId={projectId}
                      projectName={projectName}
                      rollup={r}
                      milestones={milestones}
                      deps={deps}
                      gates={gates}
                      gateLinks={gateLinks}
                      majorLabelOf={majorLabelOf}
                      updates={updates}
                      tasks={tasks}
                      activity={activity}
                      users={users}
                      conflicts={conflicts}
                      isAdmin={isAdmin}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function summarise(rollups: MajorRollup[]): string {
  const active = rollups.filter(r => r.status === 'active' || r.status === 'at_risk').length
  const next = focusMajor(rollups)
  const gate = next?.end ? ` · next gate ${formatShortDate(next.end)}` : ''
  return `${rollups.length} major milestones · ${active} active${gate}`
}

/**
 * Per-major actions. Manual completion is the one thing a major can't express
 * through its milestones — a stage that is genuinely done while something under
 * it is stale, cancelled, or was never worth tracking.
 */
function MajorMenu({
  rollup, onComplete,
}: {
  rollup: MajorRollup
  onComplete: (r: MajorRollup, complete: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click or Escape — a menu that only closes by re-clicking
  // the trigger feels broken.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={`Actions for ${rollup.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid place-items-center w-6 h-6 rounded text-[#9AA7B4] hover:text-[#181818] hover:bg-[#F1F5F9]"
      >
        <MoreVertical size={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 min-w-[236px] bg-white rounded border border-[#D6DEE7] shadow-lg py-1"
        >
          {rollup.manuallyCompleted ? (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onComplete(rollup, false) }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-[12.5px] text-[#3E3E3C] hover:bg-[#F7FAFC]"
            >
              <RotateCcw size={13} className="mt-0.5 shrink-0" />
              <span>
                Reopen Major Milestone
                <span className="block text-[11px] text-[#9AA7B4]">
                  Hands status back to its milestones
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onComplete(rollup, true) }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-[12.5px] text-[#3E3E3C] hover:bg-[#F7FAFC]"
            >
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" color="#22A45D" />
              <span>
                Mark Complete
                <span className="block text-[11px] text-[#9AA7B4]">
                  {rollup.status === 'complete'
                    ? 'Already complete from its milestones'
                    : `Closes this stage${rollup.milestoneCount - rollup.doneCount > 0
                        ? `, ${rollup.milestoneCount - rollup.doneCount} still open`
                        : ''}`}
                </span>
              </span>
            </button>
          )}

          {rollup.manuallyCompleted && rollup.openUnderOverride > 0 && (
            <p className="flex items-start gap-1.5 m-0 mt-1 px-3 py-2 text-[11px] border-t border-[#EDF1F5]"
               style={{ color: '#92400E' }}>
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              Closed by hand with {rollup.openUnderOverride} milestone
              {rollup.openUnderOverride > 1 ? 's' : ''} still open.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function OwnerPicker({
  label, value, user, users, onChange,
}: {
  label: string
  value: string
  user?: { id: string; full_name: string }
  users: { id: string; full_name: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[#9AA7B4]">
      {user ? (
        <span
          title={`${label}: ${user.full_name}`}
          className="inline-grid place-items-center rounded-full text-[9px] font-bold text-white shrink-0"
          style={{ width: 18, height: 18, background: label === 'Owner' ? '#2F3E50' : '#6E879E' }}
        >
          {initials(user.full_name)}
        </span>
      ) : (
        <span className="uppercase tracking-[0.1em]">{label}</span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        className="text-[11px] text-[#55677A] bg-transparent border-0 cursor-pointer hover:text-[#181818] max-w-[130px]"
      >
        <option value="">{label === 'Owner' ? 'Unowned' : 'Add Co-owner'}</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
      </select>
    </label>
  )
}

function Tag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[9.5px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  )
}

/**
 * Explains the variance number in the terms the reader is actually asking
 * about, which differ depending on why it is negative.
 */
function varianceHint(r: MajorRollup): string {
  if (r.variance === null) return 'No target date set yet.'
  if (r.status === 'complete') {
    return (r.slipDays ?? 0) > 0
      ? `Landed ${r.slipDays} day(s) after the ${r.baseline ? formatDate(r.baseline) : 'baseline'} baseline.`
      : 'Completed on or ahead of baseline.'
  }
  if ((r.slipDays ?? 0) > 0) {
    return `The target moved ${r.slipDays} day(s) past the baseline of ${r.baseline ? formatDate(r.baseline) : '—'}.`
  }
  if (r.variance < 0) return `The target passed ${Math.abs(r.variance)} day(s) ago and is still open.`
  return `${r.variance} day(s) until the target, which has not moved from baseline.`
}

function Stat({
  label, secondary, color, title, children,
}: {
  label: string
  secondary?: boolean
  color?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <span className="flex flex-col gap-px leading-[1.15]" title={title}>
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#9AA7B4]">{label}</span>
      <span
        style={{
          fontSize: 15,
          fontWeight: secondary ? 500 : 600,
          letterSpacing: '-0.01em',
          color: color ?? (secondary ? '#8A96A3' : '#181818'),
          cursor: title ? 'help' : undefined,
        }}
      >
        {children}
      </span>
    </span>
  )
}
