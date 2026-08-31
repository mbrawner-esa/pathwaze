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
//   1. ONE ROW PER PROJECT, collapsed. A project with four things in flight
//      still reads as one line; the row names the single most pressing
//      milestone (see pickCurrent) and EXPANDING it shows the full plan across
//      all three disciplines at once.
//   2. HELD AND ARCHIVED PROJECTS ARE NOT HERE AT ALL. Not greyed, not sorted
//      last — excluded. A paused project has no schedule opinion (migration
//      068) and putting it on a priority list invites work on something
//      deliberately parked.
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

/**
 * How far ahead the board looks.
 *
 * This is a LENS ON DETAIL, not a filter on projects: every active project
 * always has a row, and the horizon decides which of its sub-milestones are
 * worth showing when the row is expanded. A 1-month view is "what are we
 * actually touching now"; a 1-year view is the whole plan.
 */
export type Horizon = 1 | 3 | 6 | 12

export const HORIZONS: Horizon[] = [1, 3, 6, 12]

export const HORIZON_LABEL: Record<Horizon, string> = {
  1: '1 month', 3: '3 months', 6: '6 months', 12: '1 year',
}

/** A major milestone with the sub-milestones underneath it. */
export interface MajorGroup {
  majorKey: string
  majorLabel: string
  workstream: WorkstreamKey
  /** every sub-milestone under this major, in its own sort order */
  milestones: Milestone[]
  /** the major's own derived state, so the group header can show a light */
  health: ScheduleHealth | null
  variance: number | null
  doneCount: number
  totalCount: number
}

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
  /** the whole plan, every discipline, for the expanded card */
  groups: MajorGroup[]
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

/**
 * Is this sub-milestone worth showing at the chosen horizon?
 *
 * Undated milestones always pass. They are the ones most likely to NEED a date,
 * and hiding them behind a date filter would make the horizon control quietly
 * conceal exactly the work the meeting exists to schedule. Anything already
 * complete is dropped regardless — the card is a plan, not a record.
 */
export function inHorizon(m: Milestone, months: Horizon): boolean {
  if (m.status === 'complete') return false
  if (!m.end_date) return true
  return dayNumber(m.end_date) <= horizonEnd(months)
}

// ── selection ─────────────────────────────────────────────────────────

/**
 * The one milestone a collapsed project row should name.
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
 * Build one row per project, each carrying its whole plan.
 *
 * Held projects are dropped here rather than filtered downstream, so no later
 * stage can accidentally reintroduce them. Archived ones never reach this
 * function — the query excludes them, the same way every other list does.
 */
export function buildRows(
  projects: ProjectInput[],
  defs: MajorDef[],
  milestonesByProject: Map<string, Milestone[]>,
  stateByProject: Map<string, Pick<MajorState, 'major_key' | 'owner_id' | 'completed_at'>[]>,
  ranks: Map<string, number>,
): PriorityRow[] {
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

    const current = pickCurrent(open)
    const defByKey = new Map(defs.map(d => [d.key, d]))
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

    // The full plan, every discipline in catalog order. Majors with no
    // sub-milestones at all are omitted: an empty group is a row of chrome
    // around nothing, and there are 18 majors on every project.
    const groups: MajorGroup[] = []
    for (const ws of WORKSTREAMS) {
      for (const def of defs.filter(d => d.workstream === ws).sort((a, b) => a.sort_order - b.sort_order)) {
        const mine = all.filter(m => m.major_key === def.key)
        if (!mine.length) continue
        const rollup = rollUpMajor(def, all, undefined, completedByKey.get(def.key) ?? null, false)
        groups.push({
          majorKey: def.key,
          majorLabel: def.label,
          workstream: ws,
          milestones: [...mine].sort((a, b) => a.sort_order - b.sort_order),
          health: rollup.health,
          variance: rollup.variance,
          doneCount: rollup.doneCount,
          totalCount: rollup.milestoneCount,
        })
      }
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
      groups,
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
