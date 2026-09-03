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
  rollUpMajor, WORKSTREAMS, WORKSTREAM_LABELS,
  type MajorDef, type Milestone, type MajorRollup, type MajorState,
  type WorkstreamKey, type ScheduleHealth,
} from './workstreams'
import type { Momentum } from './momentum'
import type { RiskBand } from './risk'

/**
 * How far ahead the board looks.
 *
 * This is a LENS ON DETAIL, not a filter on projects: every active project
 * always has a row, and the horizon decides which of its sub-milestones are
 * worth showing when the row is expanded. "This Week" is what we are actually
 * touching now; "Long Term" is the shape of the plan.
 *
 * Named rather than numeric because these are the words the meeting already
 * uses. The spans behind them are an implementation detail, shown as a hint on
 * the control so nobody has to guess what "Near Term" means.
 */
export type Horizon = 'week' | 'near' | 'long'

export const HORIZONS: Horizon[] = ['week', 'near', 'long']

export const HORIZON_LABEL: Record<Horizon, string> = {
  week: 'This Week', near: 'Near Term', long: 'Long Term',
}

export const HORIZON_HINT: Record<Horizon, string> = {
  week: 'next 7 days', near: '1 month', long: '6 months',
}

/** Days each horizon reaches forward. */
const HORIZON_DAYS: Record<Horizon, number> = { week: 7, near: 30, long: 182 }

/**
 * Months of axis the Gantt draws for each horizon. "This Week" still gets a
 * full month rather than a single column — an axis narrower than that has
 * nowhere to put a marker.
 */
export const HORIZON_GANTT_MONTHS: Record<Horizon, number> = { week: 1, near: 2, long: 6 }

/**
 * A sub-milestone plus everything the board's card shows beside it, resolved
 * once here rather than looked up per render.
 */
export interface CardMilestone {
  milestone: Milestone
  majorKey: string
  majorLabel: string
  workstream: WorkstreamKey
  /** department names tagged on this milestone (migration 068) */
  teams: string[]
  /** marked as this week's focus — a shared team flag, not a personal bookmark */
  focus: boolean
  /** number of comments on the thread, so the row can show there is context */
  comments: number
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

  // ── filter / group dimensions ──
  tranche: string | null
  /** project manager — `projects.assignee_id`, distinct from a major's owner */
  pmId: string | null
  pmName: string | null
  /** disciplines this project has OPEN work in, for the workstream filter */
  workstreams: WorkstreamKey[]

  /** the project's whole plan, flattened, for the expanded card */
  cardMilestones: CardMilestone[]

  // ── scores ──
  momentum: Momentum | null
  /** last cached LLM judgement; null until the project has been scored */
  risk: ProjectRisk | null
}

/** The cached row from `project_risk` (migration 070). */
export interface ProjectRisk {
  score: number
  band: RiskBand
  drivers: string[]
  summary: string | null
  scoredAt: string
  /** true when the inputs have changed since this score was computed */
  stale: boolean
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
export function horizonEnd(h: Horizon): number {
  return todayNumber() + HORIZON_DAYS[h]
}

/**
 * Is this sub-milestone worth showing at the chosen horizon?
 *
 * Undated milestones always pass. They are the ones most likely to NEED a date,
 * and hiding them behind a date filter would make the horizon control quietly
 * conceal exactly the work the meeting exists to schedule. Anything already
 * complete is dropped regardless — the card is a plan, not a record.
 */
export function inHorizon(m: Milestone, h: Horizon): boolean {
  if (m.status === 'complete') return false
  if (!m.end_date) return true
  return dayNumber(m.end_date) <= horizonEnd(h)
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
  tranche: string | null
  assignee_id: string | null
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
  pmNames: Map<string, string> = new Map(),
  momentumByProject: Map<string, Momentum> = new Map(),
  riskByProject: Map<string, ProjectRisk> = new Map(),
  /** milestone_id -> department display names (migration 068) */
  teamsByMilestone: Map<string, string[]> = new Map(),
  /** milestone ids marked as this week's focus (migration 072) */
  focusIds: Set<string> = new Set(),
  /** milestone_id -> comment count */
  commentCounts: Map<string, number> = new Map(),
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
      tranche: p.tranche || null,
      pmId: p.assignee_id,
      pmName: p.assignee_id ? pmNames.get(p.assignee_id) ?? null : null,
      // Disciplines with OPEN work, not merely with a seeded major — a project
      // whose Approvals milestones are all done should not answer a filter for
      // "show me what Approvals is carrying".
      workstreams: WORKSTREAMS.filter(ws =>
        open.some(m => defByKey.get(m.major_key)?.workstream === ws)),
      // Flattened once here, ordered by due date. Due-date order is the default
      // because the card's job is "what lands next"; focus re-sorts it once the
      // team has marked anything, and undated items sit last rather than first
      // — an undated milestone is unplanned, not urgent.
      cardMilestones: groups
        .flatMap(g => g.milestones.map(m => ({
          milestone: m,
          majorKey: g.majorKey,
          majorLabel: g.majorLabel,
          workstream: g.workstream,
          teams: teamsByMilestone.get(m.id) ?? [],
          focus: focusIds.has(m.id),
          comments: commentCounts.get(m.id) ?? 0,
        })))
        .sort(byDueDate),
      momentum: momentumByProject.get(p.id) ?? null,
      risk: riskByProject.get(p.id) ?? null,
    })
  }

  return rows
}

/**
 * Due-date order for the card: soonest first, undated last.
 *
 * Undated milestones sort to the END rather than the start. A missing date is
 * "not planned yet", and floating those above dated work would put the least
 * decided items at the top of a list about what happens next.
 */
export function byDueDate(a: CardMilestone, b: CardMilestone): number {
  const da = a.milestone.end_date
  const db = b.milestone.end_date
  if (da && db) {
    const d = dayNumber(da) - dayNumber(db)
    if (d !== 0) return d
  } else if (da) return -1
  else if (db) return 1
  return a.milestone.sort_order - b.milestone.sort_order
}

/**
 * Focus first, then due date.
 *
 * Focus is the answer to "what are we doing this week", so it belongs at the
 * top of the list regardless of when it happens to be due — that is the whole
 * reason for marking it.
 */
export function byFocus(a: CardMilestone, b: CardMilestone): number {
  if (a.focus !== b.focus) return a.focus ? -1 : 1
  return byDueDate(a, b)
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

// ── filtering and grouping ────────────────────────────────────────────
// The board reuses the vocabulary of the projects list — workstream, project
// manager, tranche — so someone moving between the two pages does not have to
// learn a second set of controls.

export interface BoardFilters {
  /** discipline; 'all' keeps every project */
  workstream: WorkstreamKey | 'all'
  /** project-manager user id, or 'all' */
  pm: string | 'all'
  /** tranche value, or 'all' */
  tranche: string | 'all'
}

export type GroupBy = 'none' | 'workstream' | 'pm' | 'tranche'

export const GROUP_LABEL: Record<GroupBy, string> = {
  none: 'No grouping',
  workstream: 'Workstream',
  pm: 'Project manager',
  tranche: 'Tranche',
}

export const EMPTY_FILTERS: BoardFilters = { workstream: 'all', pm: 'all', tranche: 'all' }

/**
 * Apply the header filters.
 *
 * The workstream filter genuinely removes projects, unlike the old lens tabs:
 * a filter that left every row in place while emptying its contents would be a
 * confusing thing to call a filter. Rows keep their relative order.
 */
export function filterRows(rows: PriorityRow[], f: BoardFilters): PriorityRow[] {
  return rows.filter(r =>
    (f.workstream === 'all' || r.workstreams.includes(f.workstream)) &&
    (f.pm === 'all' || r.pmId === f.pm) &&
    (f.tranche === 'all' || (r.tranche ?? '') === f.tranche))
}

/** Distinct values present in the data, for populating the selects. */
export function filterOptions(rows: PriorityRow[]) {
  const pms = new Map<string, string>()
  const tranches = new Set<string>()
  for (const r of rows) {
    if (r.pmId) pms.set(r.pmId, r.pmName || 'Unnamed')
    if (r.tranche) tranches.add(r.tranche)
  }
  return {
    pms: Array.from(pms.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    tranches: Array.from(tranches).sort(),
  }
}

export interface RowGroup {
  key: string
  label: string
  rows: PriorityRow[]
}

/**
 * Group for display, preserving the board's order inside each group.
 *
 * A project with work in two disciplines appears under BOTH when grouping by
 * workstream. That is deliberate: the question "what is Technical carrying" has
 * to include a project Technical shares, and forcing a single bucket would hide
 * it from one of the teams that owns it. Every other dimension is single-valued
 * and so appears once.
 */
export function groupRows(rows: PriorityRow[], by: GroupBy): RowGroup[] | null {
  if (by === 'none') return null

  const buckets = new Map<string, RowGroup>()
  const push = (key: string, label: string, row: PriorityRow) => {
    const g = buckets.get(key)
    if (g) g.rows.push(row)
    else buckets.set(key, { key, label, rows: [row] })
  }

  for (const r of rows) {
    if (by === 'workstream') {
      if (!r.workstreams.length) push('none', 'No open work', r)
      else for (const ws of r.workstreams) push(ws, WORKSTREAM_LABELS[ws], r)
    } else if (by === 'pm') {
      push(r.pmId ?? 'none', r.pmName ?? 'Unassigned', r)
    } else {
      push(r.tranche ?? 'none', r.tranche ?? 'No tranche', r)
    }
  }

  // Unassigned buckets sort last — they are a gap to fill, not a category.
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.key === 'none') return 1
    if (b.key === 'none') return -1
    return a.label.localeCompare(b.label)
  })
}
