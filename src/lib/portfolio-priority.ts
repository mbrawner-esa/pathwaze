// Portfolio priority — one row per actively-worked project, ranked by what
// needs attention first.
//
// The question this answers is "where does the team put its effort this week",
// which is NOT the same as "what changed" (an activity feed) or "what is the
// status of everything" (the projects list). It is a planning surface: a
// Director opens it in a Monday meeting, sees the portfolio in priority order,
// and re-orders it or moves a date while everyone is looking at it.
//
// Three rules shape this file:
//   1. ONE ROW PER PROJECT. A project with four things in flight still reads as
//      one line, because the unit of a portfolio conversation is the project.
//      The row names the single most pressing milestone (see pickCurrent) and
//      the project page carries the rest.
//   2. HELD PROJECTS ARE NOT HERE AT ALL. Not greyed, not sorted last —
//      excluded. A paused project has no schedule opinion (migration 068) and
//      putting it on a priority list invites work on something deliberately
//      parked.
//   3. NOTHING IS RE-DERIVED. Variance, health and status come from
//      `rollUpMajor` in `workstreams.ts`, which is the one place those rules
//      live. This file selects and ranks; it does not recompute.
//
// Nothing here writes.

import {
  rollUpMajor, WORKSTREAMS,
  type MajorDef, type Milestone, type MajorRollup, type MajorState,
  type WorkstreamKey, type ScheduleHealth,
} from './workstreams'

/** How far ahead the board is looking. Mirrors the horizon control in the UI. */
export type Horizon = 1 | 3 | 6 | 12

export const HORIZONS: Horizon[] = [1, 3, 6, 12]

export const HORIZON_LABEL: Record<Horizon, string> = {
  1: '1M', 3: '3M', 6: '6M', 12: '1Y',
}

/** Which lens the board is under. 'overview' spans all three workstreams. */
export type Lens = 'overview' | WorkstreamKey

/** The filter chips. A row must match EVERY active chip to survive. */
export type PriorityFilter = 'delayed' | 'at_risk' | 'critical'

export interface PriorityRow {
  projectId: string
  name: string
  projectNumber: string | null
  stage: string
  dealHealth: string
  /** the major the current milestone sits under — the project's working phase */
  phaseLabel: string | null
  phaseWorkstream: WorkstreamKey | null
  /** the single milestone this project is most pressingly working */
  current: Milestone | null
  /** whoever owns the phase; milestones themselves carry no owner (migration 055) */
  ownerId: string | null
  /** traffic light for the current milestone's own major */
  health: ScheduleHealth | null
  /** signed days: positive is room before the target, negative is behind */
  variance: number | null
  /** soonest future critical-path milestone inside the horizon */
  nextCritical: { label: string; date: string } | null
  /** true when any open milestone under this project is flagged critical */
  hasCritical: boolean
  /** manual rank from `portfolio_priority`, or null when unranked */
  rank: number | null
}

// ── date helpers ──────────────────────────────────────────────────────
// Calendar days, never instants — the same rule as workstreams.ts. Parsing a
// DATE column through the local timezone shifts it a day west of UTC.

const MS_PER_DAY = 86_400_000

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

function todayNumber(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY
}

/** Last day inside the horizon, as a day number. */
export function horizonEnd(months: Horizon): number {
  const now = new Date()
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()))
  return end.getTime() / MS_PER_DAY
}

// ── selection ─────────────────────────────────────────────────────────

/**
 * The one milestone a project row should name.
 *
 * Preference order, and the reasoning for it:
 *   1. BLOCKED — someone has said out loud that this is stuck. That outranks
 *      every date, because a date can still be met and a block cannot be
 *      ignored.
 *   2. OVERDUE — its target has passed and nobody has moved it. Ranked above
 *      in-progress work because it is already costing time.
 *   3. IN PROGRESS, soonest target first — the work actually underway.
 *   4. the soonest-dated open milestone — nothing has started, so the next
 *      commitment is the thing to talk about.
 *   5. any open milestone in catalog order — an undated plan still deserves a
 *      row rather than an empty one.
 *
 * Ties break on target date, then on the milestone's own sort order, so the
 * choice is stable across renders rather than depending on row arrival order.
 */
export function pickCurrent(open: Milestone[]): Milestone | null {
  if (!open.length) return null

  const byDate = (a: Milestone, b: Milestone) => {
    if (a.end_date && b.end_date) {
      const d = dayNumber(a.end_date) - dayNumber(b.end_date)
      if (d !== 0) return d
    } else if (a.end_date) return -1
    else if (b.end_date) return 1
    return a.sort_order - b.sort_order
  }

  const blocked = open.filter(m => m.status === 'blocked')
  if (blocked.length) return blocked.sort(byDate)[0]

  const today = todayNumber()
  const overdue = open.filter(m => m.end_date && dayNumber(m.end_date) < today)
  if (overdue.length) return overdue.sort(byDate)[0]

  const inProgress = open.filter(m => m.status === 'in_progress')
  if (inProgress.length) return inProgress.sort(byDate)[0]

  const dated = open.filter(m => m.end_date)
  return (dated.length ? dated : open).sort(byDate)[0]
}

/**
 * The soonest critical-path milestone still ahead of us, inside the horizon.
 *
 * Deliberately excludes the current milestone: the row already names that one,
 * and repeating it in the "next critical" column would waste the column on
 * every row whose current work happens to be critical.
 */
function pickNextCritical(
  open: Milestone[],
  currentId: string | null,
  endOfHorizon: number,
): { label: string; date: string } | null {
  const today = todayNumber()
  const candidates = open
    .filter(m => m.is_critical && m.id !== currentId && m.end_date)
    .filter(m => {
      const d = dayNumber(m.end_date as string)
      return d >= today && d <= endOfHorizon
    })
    .sort((a, b) => dayNumber(a.end_date as string) - dayNumber(b.end_date as string))

  const pick = candidates[0]
  return pick ? { label: pick.label, date: pick.end_date as string } : null
}

// ── the row build ─────────────────────────────────────────────────────

export interface ProjectInput {
  id: string
  name: string
  project_number: string | null
  stage: string
  deal_health: string | null
  on_hold_at: string | null
}

/**
 * Build one row per project. Held projects are dropped here rather than
 * filtered downstream, so no later stage can accidentally reintroduce them.
 */
export function buildRows(
  projects: ProjectInput[],
  defs: MajorDef[],
  milestonesByProject: Map<string, Milestone[]>,
  stateByProject: Map<string, Pick<MajorState, 'major_key' | 'owner_id' | 'completed_at'>[]>,
  ranks: Map<string, number>,
  lens: Lens,
  horizon: Horizon,
): PriorityRow[] {
  const endOfHorizon = horizonEnd(horizon)
  const defByKey = new Map(defs.map(d => [d.key, d]))
  const rows: PriorityRow[] = []

  for (const p of projects) {
    if (p.on_hold_at) continue   // rule 2 — held projects are not on this board

    const all = milestonesByProject.get(p.id) ?? []
    const state = stateByProject.get(p.id) ?? []
    const completedByKey = new Map(state.map(s => [s.major_key, s.completed_at]))
    const ownerByKey = new Map(state.map(s => [s.major_key, s.owner_id]))

    // A manually-completed major is done regardless of what sits under it, so
    // its milestones must not be offered as current work.
    const open = all.filter(m =>
      m.status !== 'complete' && !completedByKey.get(m.major_key))

    // The lens narrows which milestones can drive the row, but never which
    // projects appear: a project with no Commercial work still gets a lane, it
    // just reads empty. Dropping it instead would make the row set jump around
    // as you switch tabs, which is the one thing a comparison view must not do.
    const inLens = lens === 'overview'
      ? open
      : open.filter(m => defByKey.get(m.major_key)?.workstream === lens)

    const current = pickCurrent(inLens)
    const phase = current ? defByKey.get(current.major_key) ?? null : null

    // Health and variance come from the current milestone's own major, so the
    // number in the row and the light beside it always describe the same thing.
    let health: ScheduleHealth | null = null
    let variance: number | null = null
    if (phase) {
      const rollup: MajorRollup = rollUpMajor(
        phase, all, undefined, completedByKey.get(phase.key) ?? null, false)
      health = rollup.health
      variance = rollup.variance
    }

    rows.push({
      projectId: p.id,
      name: p.name,
      projectNumber: p.project_number,
      stage: p.stage,
      dealHealth: p.deal_health ?? 'TBD',
      phaseLabel: phase?.label ?? null,
      phaseWorkstream: phase?.workstream ?? null,
      current,
      ownerId: current ? ownerByKey.get(current.major_key) ?? null : null,
      health,
      variance,
      nextCritical: pickNextCritical(inLens, current?.id ?? null, endOfHorizon),
      hasCritical: inLens.some(m => m.is_critical),
      rank: ranks.get(p.id) ?? null,
    })
  }

  return rows
}

// ── ordering ──────────────────────────────────────────────────────────

/**
 * Urgency order — the default when nobody has dragged the list.
 *
 * Delayed before at-risk before on-track, then soonest target first. This is
 * the order the page opens in, and the order "Reset to urgency" returns to.
 */
export function byUrgency(a: PriorityRow, b: PriorityRow): number {
  const rank: Record<string, number> = { delayed: 0, at_risk: 1, on_track: 2 }
  const ha = a.health ? rank[a.health] : 3
  const hb = b.health ? rank[b.health] : 3
  if (ha !== hb) return ha - hb

  const da = a.current?.end_date
  const db = b.current?.end_date
  if (da && db) {
    const d = dayNumber(da) - dayNumber(db)
    if (d !== 0) return d
  } else if (da) return -1
  else if (db) return 1

  return a.name.localeCompare(b.name)
}

/**
 * Apply the board's order: manual rank where one exists, urgency otherwise.
 *
 * A newly-added project has no rank and would otherwise sort to the top or
 * vanish, so unranked rows fall to the end of the manual list in urgency order
 * — visible, clearly not yet placed, and one drag from where they belong.
 */
export function orderRows(rows: PriorityRow[], manual: boolean): PriorityRow[] {
  const out = [...rows]
  if (!manual) return out.sort(byUrgency)

  return out.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank
    if (a.rank !== null) return -1
    if (b.rank !== null) return 1
    return byUrgency(a, b)
  })
}

// ── filtering ─────────────────────────────────────────────────────────

/** Does a row satisfy one chip? */
function matches(row: PriorityRow, f: PriorityFilter): boolean {
  switch (f) {
    case 'delayed':  return row.health === 'delayed'
    case 'at_risk':  return row.health === 'at_risk'
    case 'critical': return row.hasCritical
  }
}

/**
 * Chips are AND-ed, not OR-ed.
 *
 * "Delayed + Critical path" means the delayed things that are ALSO on the
 * critical path — the shortest, most useful list in a planning meeting. OR-ing
 * them would grow the list as you add filters, which reads as broken.
 */
export function applyFilters(rows: PriorityRow[], active: PriorityFilter[]): PriorityRow[] {
  if (!active.length) return rows
  return rows.filter(row => active.every(f => matches(row, f)))
}

/** Counts for the chip labels — always over the unfiltered set. */
export function filterCounts(rows: PriorityRow[]): Record<PriorityFilter, number> {
  return {
    delayed: rows.filter(r => matches(r, 'delayed')).length,
    at_risk: rows.filter(r => matches(r, 'at_risk')).length,
    critical: rows.filter(r => matches(r, 'critical')).length,
  }
}

/** Lens tabs, in the order the project tab already shows them. */
export const LENSES: { key: Lens; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  ...WORKSTREAMS.map(w => ({
    key: w as Lens,
    label: w.charAt(0).toUpperCase() + w.slice(1),
  })),
]
