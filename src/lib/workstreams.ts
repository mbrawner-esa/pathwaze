// Workstreams — derivation logic shared by the tab, the Overview view and (later)
// Reports. See ROADMAP.md → Appendix A for the settled requirements.
//
// Hierarchy: workstream → MAJOR MILESTONE (catalog) → MILESTONE → TASK.
//
// Two rules shape this file:
//   1. MAJOR MILESTONES STORE ALMOST NOTHING. Their window, status and progress
//      are derived from their milestones on every read. Only ownership is stored.
//   2. A MILESTONE IS NOT A TASK. The work under a milestone is ordinary `tasks`
//      rows, so it appears in /tasks like everything else.
//
// Nothing here writes.

export type WorkstreamKey = 'commercial' | 'technical' | 'approvals'
export const WORKSTREAMS: WorkstreamKey[] = ['commercial', 'technical', 'approvals']

export const WORKSTREAM_LABELS: Record<WorkstreamKey, string> = {
  commercial: 'Commercial',
  technical: 'Technical',
  approvals: 'Approvals',
}

/**
 * What a person knows that the dates cannot infer.
 *
 * There is deliberately no 'at_risk' here: a target that has moved past its
 * baseline, or one landing inside a week, IS at risk, and the traffic light
 * derives both. A manual flag alongside them would be a second source for the
 * same claim, free to disagree with no way to tell which was right.
 */
export type MilestoneStatus = 'not_started' | 'in_progress' | 'blocked' | 'complete'
export type MajorStatus = 'upcoming' | 'active' | 'at_risk' | 'complete'

/**
 * Schedule health, as a traffic light. Distinct from MajorStatus, which is about
 * how much work is done; this is purely about whether the dates still hold.
 *   on_track — target has not moved and there is room before it
 *   at_risk  — target has not moved but it lands within a week
 *   delayed  — the target moved past its baseline, or it has already passed
 */
export type ScheduleHealth = 'on_track' | 'at_risk' | 'delayed'

/** Below this many days to target, an untouched date still counts as at risk. */
export const AT_RISK_DAYS = 7

/** A major milestone — a build-owned catalog row, identical across projects. */
export interface MajorDef {
  key: string
  workstream: WorkstreamKey
  label: string
  description: string | null
  sort_order: number
}

/** The only per-project state a major carries. */
export interface MajorState {
  project_id: string
  major_key: string
  owner_id: string | null
  co_owner_id: string | null
  celebrated_at: string | null
  /** manual completion override; null means status is derived */
  completed_at: string | null
  completed_by: string | null
}

/** A per-project, user-editable stage gate or key objective on a major. */
export interface Gate {
  id: string
  project_id: string
  major_key: string
  kind: 'gate' | 'objective'
  label: string
  status: 'open' | 'pass' | 'fail'
  sort_order: number
}

/** A user-created milestone. Planning checkpoint, not a work item. */
export interface Milestone {
  id: string
  project_id: string
  major_key: string
  label: string
  description: string | null
  stage_gate: string | null
  weight_pct: number
  is_critical: boolean
  /** target completion date — moves as the plan moves */
  end_date: string | null
  /** originally scheduled completion; auto-captured then admin-locked */
  baseline_date: string | null
  status: MilestoneStatus
  completed_at: string | null
  notes: string | null
  risk: string | null
  sort_order: number
}

export interface MilestoneDep {
  milestone_id: string
  depends_on: string
}

/**
 * A milestone an exit gate depends on. May cross workstreams — this is how a
 * Commercial gate waits on a Technical milestone.
 */
export interface GateLink {
  gate_id: string
  milestone_id: string
}

/**
 * Emoji markers for key objectives, in place of 1/2/3. Chosen by position so
 * an objective keeps the same mark as long as its order holds, and picked to
 * read as distinct shapes at 15px rather than as a rainbow.
 */
const OBJECTIVE_MARKS = ['🎯', '🔍', '⚙️', '📐', '🤝', '📊', '🧭', '✅'] as const

export function objectiveMark(index: number): string {
  return OBJECTIVE_MARKS[index % OBJECTIVE_MARKS.length]
}

/**
 * Variance as a signed day count: "+23d" of room, or "-19d" behind.
 * Uses a real minus sign rather than a hyphen so the digits stay aligned in the
 * tabular figures the column is set in.
 */
export function varianceLabel(variance: number | null): string | null {
  if (variance === null) return null
  if (variance === 0) return '0d'
  return variance > 0 ? `+${variance}d` : `\u2212${Math.abs(variance)}d`
}

/** Plain-language name for the traffic light. */
export const HEALTH_LABEL: Record<ScheduleHealth, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  delayed: 'Delayed',
}

/** The subset of a task this module needs. */
export interface LinkedTask {
  id: string
  title: string
  status: string
  assignee_id: string | null
  due_date: string | null
  completed_at: string | null
  workstream_milestone_id: string | null
}

export const TASK_COMPLETE = 'Complete'

// ── date helpers ──────────────────────────────────────────────────────
// Dates are DATE columns ("2026-08-24"), so parse them as calendar days and
// never as instants — going through the local timezone would shift a date by a
// day for anyone west of UTC.

const MS_PER_DAY = 86_400_000

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

/** Today as the same kind of calendar-day number, in UTC. */
export function todayNumber(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / MS_PER_DAY
}

/** Inclusive day count between two ISO dates. */
export function daysBetween(startIso: string, endIso: string): number {
  return dayNumber(endIso) - dayNumber(startIso) + 1
}

// ── the roll-up ───────────────────────────────────────────────────────

export interface MajorRollup {
  key: string
  label: string
  workstream: WorkstreamKey
  status: MajorStatus
  /** earliest milestone target — the left edge of the Overview bar */
  start: string | null
  /** latest milestone target — the major's own target date */
  end: string | null
  /** latest milestone baseline — where this major was originally due */
  baseline: string | null
  /**
   * Days the major's target has moved past its baseline. Positive = late
   * against the original commitment, 0 = on plan, negative = pulled in.
   * Null when there is nothing to compare.
   *
   * This is the headline risk signal, not "is it past due today": slip shows
   * up the moment a date moves, while overdue only fires once it is already too
   * late to react.
   */
  slipDays: number | null
  /** milestones whose target has moved past their baseline */
  slippedCount: number
  /** incomplete milestones whose target date has already passed */
  overdueCount: number
  /** inclusive span from first to last target, null unless both are known */
  totalDays: number | null
  /**
   * Calendar days from today to the target. NEGATIVE once the target has passed,
   * deliberately: a clamped-at-zero figure cannot say how late something is.
   */
  daysToTarget: number | null
  /**
   * The single schedule number, measuring the plan against its baseline.
   * Positive is days of room left before the target; negative is days behind,
   * either because the target moved past its baseline or because it has passed.
   */
  variance: number | null
  /** traffic light for `variance` */
  health: ScheduleHealth | null
  /** 0-100, weighted by weight_pct where set, equal-weighted otherwise */
  pct: number
  /** true when weight_pct was used; false when it fell back to equal weighting */
  weighted: boolean
  /** sum of weight_pct across this major's milestones — should be 100 */
  weightTotal: number
  milestoneCount: number
  doneCount: number
  /** any milestone flagged is_critical */
  hasCritical: boolean
  /** a milestone is dated before a predecessor finishes */
  hasDateConflict: boolean
  /** completed by hand rather than by every milestone being done */
  manuallyCompleted: boolean
  /** open milestones still underneath a manually-completed major */
  openUnderOverride: number
}

/**
 * Derive a major milestone's window, status and progress from its milestones.
 *
 * Status rules:
 *  - no milestones at all            → upcoming (nothing planned yet)
 *  - every milestone complete        → complete
 *  - any blocked / at_risk           → at_risk ("worst child wins", so an amber
 *                                      major is always explained by something
 *                                      underneath it)
 *  - any in progress, or the window has opened → active
 *  - otherwise                       → upcoming
 *
 * Progress rules:
 *  - if any milestone carries a weight, progress is the completed share of the
 *    TOTAL weight — so an all-complete major always reads 100%, even when the
 *    weights don't add to 100 (that mistake is surfaced via `weightTotal`
 *    instead of silently distorting the bar).
 *  - otherwise every milestone counts equally.
 */
export function rollUpMajor(
  def: MajorDef,
  milestones: Milestone[],
  conflicts: Set<string> = new Set(),
  /**
   * Manual completion override (workstream_major_state.completed_at). When set,
   * the major reads complete and 100% no matter what sits underneath it — the
   * escape hatch for a stage that is genuinely finished while some milestone
   * under it is stale or was never worth tracking.
   */
  completedOverride: string | null = null,
): MajorRollup {
  const mine = milestones.filter(m => m.major_key === def.key)

  // Milestones carry a single target date, so the major's span runs from its
  // earliest target to its latest. The latest target IS the major's due date.
  const targets = mine.map(m => m.end_date).filter((d): d is string => !!d)
  const baselines = mine.map(m => m.baseline_date).filter((d): d is string => !!d)
  const start = targets.length ? targets.reduce((a, b) => (a < b ? a : b)) : null
  const end = targets.length ? targets.reduce((a, b) => (a > b ? a : b)) : null
  const baseline = baselines.length ? baselines.reduce((a, b) => (a > b ? a : b)) : null

  const doneCount = mine.filter(m => m.status === 'complete').length
  const allDone = mine.length > 0 && doneCount === mine.length

  // Slip is measured at the major's own level: where it is now due against
  // where it was originally due.
  const slipDays = end && baseline ? dayNumber(end) - dayNumber(baseline) : null
  const slippedCount = mine.filter(m =>
    m.end_date && m.baseline_date && dayNumber(m.end_date) > dayNumber(m.baseline_date)).length
  const overdueCount = mine.filter(m =>
    m.status !== 'complete' && m.end_date && dayNumber(m.end_date) < todayNumber()).length

  const manuallyCompleted = !!completedOverride

  let status: MajorStatus
  if (manuallyCompleted) status = 'complete'
  else if (mine.length === 0) status = 'upcoming'
  else if (allDone) status = 'complete'
  else if (mine.some(m => m.status === 'blocked')) status = 'at_risk'
  // A milestone past its target with nobody having said so is exactly the case
  // the status field misses, so the dates escalate it on their own.
  else if (overdueCount > 0) status = 'at_risk'
  else if (mine.some(m => m.status === 'in_progress')) status = 'active'
  else if (start && dayNumber(start) <= todayNumber()) status = 'active'
  else status = 'upcoming'

  const weightTotal = mine.reduce((sum, m) => sum + Number(m.weight_pct ?? 0), 0)
  const weighted = weightTotal > 0
  let pct: number
  if (manuallyCompleted) {
    pct = 100
  } else if (!mine.length) {
    pct = 0
  } else if (weighted) {
    const doneWeight = mine
      .filter(m => m.status === 'complete')
      .reduce((sum, m) => sum + Number(m.weight_pct ?? 0), 0)
    pct = Math.round((doneWeight / weightTotal) * 100)
  } else {
    pct = Math.round((doneCount / mine.length) * 100)
  }

  const daysToTarget = end ? dayNumber(end) - todayNumber() : null

  // Variance answers one question: are we ahead of the commitment or behind it?
  // Slip (target moved) and overdue (target passed) are both "behind", so they
  // collapse into one negative number rather than competing for attention.
  let variance: number | null = null
  let health: ScheduleHealth | null = null
  if (end !== null) {
    const slipped = (slipDays ?? 0) > 0
    if (status === 'complete') {
      // Finished: the honest figure is how it landed against the baseline.
      variance = -(slipDays ?? 0)
      health = slipped ? 'delayed' : 'on_track'
    } else if (slipped) {
      variance = -(slipDays as number)
      health = 'delayed'
    } else if ((daysToTarget as number) < 0) {
      variance = daysToTarget
      health = 'delayed'
    } else if ((daysToTarget as number) <= AT_RISK_DAYS) {
      variance = daysToTarget
      health = 'at_risk'
    } else {
      variance = daysToTarget
      health = 'on_track'
    }
  }

  return {
    key: def.key,
    label: def.label,
    workstream: def.workstream,
    status,
    start,
    end,
    baseline,
    slipDays,
    slippedCount,
    overdueCount,
    totalDays: start && end ? daysBetween(start, end) : null,
    daysToTarget,
    variance,
    health,
    pct,
    weighted,
    weightTotal: Math.round(weightTotal * 100) / 100,
    milestoneCount: mine.length,
    doneCount,
    hasCritical: mine.some(m => m.is_critical),
    hasDateConflict: mine.some(m => conflicts.has(m.id)),
    manuallyCompleted,
    // Surfaced in the UI so a hand-closed major that still has live work under
    // it says so, rather than quietly hiding it behind a green tick.
    openUnderOverride: manuallyCompleted ? mine.length - doneCount : 0,
  }
}

/**
 * Whether a major's weights are a coherent plan. Only meaningful once weights
 * are in use at all — an unweighted major is fine, not broken.
 */
export function weightWarning(r: MajorRollup): string | null {
  if (!r.weighted || r.milestoneCount === 0) return null
  if (Math.abs(r.weightTotal - 100) < 0.01) return null
  return r.weightTotal > 100
    ? `Weights total ${r.weightTotal}% — ${Math.round((r.weightTotal - 100) * 100) / 100}% over`
    : `Weights total ${r.weightTotal}% — ${Math.round((100 - r.weightTotal) * 100) / 100}% unassigned`
}

// ── dependencies ──────────────────────────────────────────────────────

/**
 * Milestones due on or before something they depend on — an impossible plan.
 *
 * With a single target date per milestone, "out of order" means the successor's
 * target is not strictly after its predecessor's.
 *
 * We FLAG rather than reject, because a PM legitimately needs to record a
 * slipped predecessor before re-planning the successor — but the flag has to be
 * loud.
 */
export function dateConflicts(milestones: Milestone[], deps: MilestoneDep[]): Set<string> {
  const byId = new Map(milestones.map(m => [m.id, m]))
  const bad = new Set<string>()

  for (const { milestone_id, depends_on } of deps) {
    const successor = byId.get(milestone_id)
    const predecessor = byId.get(depends_on)
    if (!successor?.end_date || !predecessor?.end_date) continue
    if (dayNumber(successor.end_date) <= dayNumber(predecessor.end_date)) bad.add(milestone_id)
  }

  return bad
}

/**
 * Major-level dependency edges, derived from the milestone-level ones — never
 * stored. Used by the Overview view. Self-edges (both ends under the same
 * major) are dropped.
 */
export function derivedMajorDeps(
  milestones: Milestone[],
  deps: MilestoneDep[],
): { from: string; to: string }[] {
  const majorOf = new Map(milestones.map(m => [m.id, m.major_key]))
  const seen = new Set<string>()
  const out: { from: string; to: string }[] = []

  for (const { milestone_id, depends_on } of deps) {
    const to = majorOf.get(milestone_id)
    const from = majorOf.get(depends_on)
    if (!to || !from || to === from) continue
    const k = `${from}→${to}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ from, to })
  }

  return out
}

// ── tasks under a milestone ───────────────────────────────────────────

/** Tasks grouped by the milestone they deliver. */
export function tasksByMilestone(tasks: LinkedTask[]): Map<string, LinkedTask[]> {
  const out = new Map<string, LinkedTask[]>()
  for (const t of tasks) {
    if (!t.workstream_milestone_id) continue
    const list = out.get(t.workstream_milestone_id)
    if (list) list.push(t)
    else out.set(t.workstream_milestone_id, [t])
  }
  return out
}

/**
 * Milestones an exit gate is waiting on, with the ones still open called out.
 *
 * Advisory by design: a gate can be passed with requirements outstanding, and
 * the UI says so loudly rather than refusing. A gate is a judgement call, and a
 * hard block would only get worked around.
 */
export function gateRequirements(
  gateId: string,
  links: GateLink[],
  milestones: Milestone[],
): { required: Milestone[]; open: Milestone[] } {
  const byId = new Map(milestones.map(m => [m.id, m]))
  const required = links
    .filter(l => l.gate_id === gateId)
    .map(l => byId.get(l.milestone_id))
    .filter((m): m is Milestone => !!m)
  return { required, open: required.filter(m => m.status !== 'complete') }
}

// ── the weekly-update thread ──────────────────────────────────────────

/** An activity_log row about a workstream, as fetched by the project page. */
export interface WorkstreamActivity {
  id: string
  action: string
  created_at: string
  user_id: string | null
  metadata: Record<string, unknown> | null
}

export type ThreadItem =
  | { kind: 'update'; id: string; at: string; userId: string | null; body: string }
  | { kind: 'task'; id: string; at: string; userId: string | null; taskId: string; title: string }
  | { kind: 'event'; id: string; at: string; userId: string | null; text: string; tone: 'good' | 'warn' | 'plain' }

/**
 * Human phrasing for an activity row. Returns null for actions that shouldn't
 * appear in the thread — either because they're noise, or because the thread
 * already shows the thing itself (a written update is rendered from
 * workstream_updates, so logging it again would double it up).
 */
function describe(a: WorkstreamActivity): { text: string; tone: 'good' | 'warn' | 'plain' } | null {
  const m = (a.metadata ?? {}) as Record<string, string | null>
  const label = m.label ?? 'a milestone'

  switch (a.action) {
    case 'weekly_update_logged':
      return null                                  // rendered from its own table
    case 'milestone_created':
      return { text: `added milestone “${label}”`, tone: 'plain' }
    case 'milestone_deleted':
      return { text: `removed milestone “${label}”`, tone: 'warn' }
    case 'gate_added':
      return { text: `added stage gate “${label}”`, tone: 'plain' }
    case 'objective_added':
      return { text: `added objective “${label}”`, tone: 'plain' }
    case 'gate_deleted':
    case 'objective_deleted':
      return { text: `removed “${label}”`, tone: 'warn' }
    case 'gate_status_changed':
      return m.to === 'pass'
        ? { text: `passed the gate “${label}”`, tone: 'good' }
        : m.to === 'fail'
          ? { text: `flagged the gate “${label}” as failed`, tone: 'warn' }
          : { text: `reopened the gate “${label}”`, tone: 'plain' }
    case 'dependency_added':
      return { text: `made “${label}” depend on “${m.depends_on_label ?? 'another milestone'}”`, tone: 'plain' }
    case 'dependency_removed':
      return { text: `removed a dependency on “${label}”`, tone: 'plain' }
    case 'major_owner_changed':
      return { text: 'changed the owner', tone: 'plain' }
    case 'major_co_owner_changed':
      return { text: 'changed the co-owner', tone: 'plain' }
    case 'major_completed':
      return { text: 'marked this major milestone complete', tone: 'good' }
    case 'major_reopened':
      return { text: 'reopened this major milestone', tone: 'warn' }
    case 'field_changed': {
      if (m.field === 'status') {
        return m.to === 'complete'
          ? { text: `completed “${label}”`, tone: 'good' }
          : { text: `moved “${label}” to ${String(m.to).replace(/_/g, ' ')}`, tone: m.to === 'blocked' || m.to === 'at_risk' ? 'warn' : 'plain' }
      }
      if (m.field === 'is_critical') {
        return m.to === 'true' || m.to === true as unknown as string
          ? { text: `flagged “${label}” as critical path`, tone: 'warn' }
          : { text: `removed the critical-path flag from “${label}”`, tone: 'plain' }
      }
      // A target moving is the thing most worth seeing in the log — it is what
      // creates slip — so it says so rather than reading as a generic edit.
      if (m.field === 'end_date') {
        return { text: `moved the target date on “${label}”`, tone: 'warn' }
      }
      if (m.field === 'baseline_date') {
        return { text: `re-baselined “${label}”`, tone: 'warn' }
      }
      if (m.field === 'weight_pct') {
        return { text: `changed the weight on “${label}”`, tone: 'plain' }
      }
      return null
    }
    default:
      return null
  }
}

/**
 * The weekly-update thread for one major: written updates, completed tasks and
 * milestone/gate events, merged newest-first.
 *
 * The point is that the log reflects what actually happened, not only what
 * someone remembered to write down — a stretch with no written update but three
 * completed tasks should still read as progress.
 */
export function buildThread({
  updates, tasks, milestones, activity, majorKey, limit = 40,
}: {
  updates: { id: string; body: string; created_at: string; created_by: string | null; major_key: string | null }[]
  tasks: LinkedTask[]
  milestones: Milestone[]
  activity: WorkstreamActivity[]
  majorKey: string
  limit?: number
}): ThreadItem[] {
  const mineIds = new Set(milestones.filter(m => m.major_key === majorKey).map(m => m.id))

  const items: ThreadItem[] = [
    ...updates
      .filter(u => u.major_key === majorKey)
      .map(u => ({
        kind: 'update' as const,
        id: `u-${u.id}`, at: u.created_at, userId: u.created_by, body: u.body,
      })),

    ...tasks
      .filter(t =>
        t.status === TASK_COMPLETE &&
        t.completed_at &&
        t.workstream_milestone_id &&
        mineIds.has(t.workstream_milestone_id))
      .map(t => ({
        kind: 'task' as const,
        id: `t-${t.id}`, at: t.completed_at as string, userId: null,
        taskId: t.id, title: t.title,
      })),

    ...activity
      .filter(a => {
        const m = (a.metadata ?? {}) as Record<string, string>
        return m.major_key === majorKey
      })
      .flatMap(a => {
        const d = describe(a)
        if (!d) return []
        return [{
          kind: 'event' as const,
          id: `a-${a.id}`, at: a.created_at, userId: a.user_id,
          text: d.text, tone: d.tone,
        }]
      }),
  ]

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

/**
 * The next actual MILESTONE, with the major it sits under.
 *
 * Distinct from nextMilestone(), which answers at the major level. A summary
 * card saying "Term Sheet" tells you far less than "Term Sheet / LNTP CFO
 * Approval" — the major is the chapter, this is the thing someone is doing.
 *
 * Preference, in order:
 *   1. Milestones actually being worked (in progress, or blocked — blocked is
 *      still the thing occupying someone). What the team is on beats what the
 *      calendar says is next.
 *   2. Otherwise the nearest BASELINE date. Baseline rather than target on
 *      purpose: the target moves, so ordering by it would let a slipping
 *      milestone quietly drop down the queue precisely when it needs attention.
 *   3. Otherwise catalog then plan order, so an undated project still names
 *      something concrete.
 */
export function nextMilestoneDetail(
  defs: MajorDef[],
  milestones: Milestone[],
  state: Pick<MajorState, 'major_key' | 'completed_at'>[] = [],
): { milestone: Milestone; majorLabel: string; workstream: WorkstreamKey } | null {
  const closed = new Set(state.filter(s => s.completed_at).map(s => s.major_key))
  const defByKey = new Map(defs.map(d => [d.key, d]))
  const rank = new Map(defs.map(d => [d.key, catalogRank(d)]))

  const open = milestones.filter(m =>
    m.status !== 'complete' && !closed.has(m.major_key) && defByKey.has(m.major_key))
  if (!open.length) return null

  const bySequence = (a: Milestone, b: Milestone) =>
    (rank.get(a.major_key) ?? 0) - (rank.get(b.major_key) ?? 0) || a.sort_order - b.sort_order

  /** Nearest baseline first; undated fall to the back, then catalog order. */
  const byBaseline = (a: Milestone, b: Milestone) => {
    if (a.baseline_date && b.baseline_date) {
      return a.baseline_date.localeCompare(b.baseline_date) || bySequence(a, b)
    }
    if (a.baseline_date) return -1
    if (b.baseline_date) return 1
    return bySequence(a, b)
  }

  const inFlight = open.filter(m => m.status === 'in_progress' || m.status === 'blocked')
  const pool = inFlight.length ? inFlight : open
  const pick = pool.sort(byBaseline)[0]

  const def = defByKey.get(pick.major_key) as MajorDef
  return { milestone: pick, majorLabel: def.label, workstream: def.workstream }
}

/**
 * What the workstreams say the project's health is.
 *
 * Deal health already uses the same three words as the schedule traffic light,
 * so this rolls straight up rather than needing a translation. It uses the same
 * "worst child wins" rule as a major's own status: one delayed major makes the
 * deal delayed, because that is what a delay means.
 *
 * This SUGGESTS; it never writes. Deal health also carries things the schedule
 * cannot see — customer sentiment, financing, a competitor — so a human stays
 * the source of truth. The value here is making disagreement visible: a green
 * deal sitting on three delayed workstreams is a conversation worth having.
 */
export type DealHealth = 'On Track' | 'At Risk' | 'Delayed' | 'TBD'

export function suggestDealHealth(rollups: MajorRollup[]): {
  value: DealHealth
  reason: string
  driver: MajorRollup | null
} {
  const dated = rollups.filter(r => r.health !== null && r.status !== 'complete')
  if (!dated.length) {
    return { value: 'TBD', reason: 'No workstream milestone has dates yet.', driver: null }
  }

  const delayed = dated.filter(r => r.health === 'delayed')
  if (delayed.length) {
    // A delay on the critical path is the one worth naming first.
    const worst = delayed.find(r => r.hasCritical)
      ?? delayed.reduce((a, b) => ((a.variance ?? 0) <= (b.variance ?? 0) ? a : b))
    const days = Math.abs(worst.variance ?? 0)
    return {
      value: 'Delayed',
      reason: delayed.length === 1
        ? `${worst.label} is ${days}d behind${worst.hasCritical ? ' on the critical path' : ''}.`
        : `${delayed.length} major milestones are behind, worst is ${worst.label} at ${days}d.`,
      driver: worst,
    }
  }

  const atRisk = dated.filter(r => r.health === 'at_risk')
  if (atRisk.length) {
    const soonest = atRisk.reduce((a, b) => ((a.variance ?? 0) <= (b.variance ?? 0) ? a : b))
    return {
      value: 'At Risk',
      reason: `${soonest.label} is due in ${soonest.variance}d.`,
      driver: soonest,
    }
  }

  return {
    value: 'On Track',
    reason: `All ${dated.length} open major milestone(s) are on or ahead of baseline.`,
    driver: null,
  }
}

// ── catalog helpers ───────────────────────────────────────────────────

/** Major milestone defs for one workstream, in catalog order. */
export function majorsFor(defs: MajorDef[], ws: WorkstreamKey): MajorDef[] {
  return defs.filter(d => d.workstream === ws).sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Catalog sequence position. `sort_order` restarts at 1 within each workstream,
 * so it is only meaningful *inside* a workstream — comparing two majors across
 * workstreams needs the workstream itself as the high-order term. Without this,
 * ordering would silently depend on the order rows came back from the query.
 */
function catalogRank(def: { workstream: WorkstreamKey; sort_order: number }): number {
  return WORKSTREAMS.indexOf(def.workstream) * 1000 + def.sort_order
}

/**
 * The major a PM most likely wants open: the first at-risk one, else the first
 * active, else the first incomplete.
 */
export function focusMajor(rollups: MajorRollup[]): MajorRollup | undefined {
  return rollups.find(r => r.status === 'at_risk')
    ?? rollups.find(r => r.status === 'active')
    ?? rollups.find(r => r.status !== 'complete')
}

/**
 * "Next Milestone" for the project overview and the projects list — the
 * replacement for `milestones.find(m => !m.completed)`.
 *
 * Preference order:
 *  1. the soonest dated deadline among open majors;
 *  2. failing that, the earliest in catalog sequence that has planned work;
 *  3. failing that, the earliest open major in catalog sequence.
 */
export function nextMilestone(
  defs: MajorDef[],
  milestones: Milestone[],
  /** major_state rows, so a manually-completed major is not announced as next */
  state: Pick<MajorState, 'major_key' | 'completed_at'>[] = [],
): MajorRollup | null {
  const rank = new Map(defs.map(d => [d.key, catalogRank(d)]))
  const overrides = new Map(state.map(s => [s.major_key, s.completed_at]))
  const bySequence = (a: MajorRollup, b: MajorRollup) =>
    (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0)

  const open = defs
    .map(d => rollUpMajor(d, milestones, undefined, overrides.get(d.key) ?? null))
    .filter(r => r.status !== 'complete')

  if (!open.length) return null

  const dated = open.filter(r => r.end)
  if (dated.length) {
    return dated.sort((a, b) => (a.end as string).localeCompare(b.end as string) || bySequence(a, b))[0]
  }

  const planned = open.filter(r => r.milestoneCount > 0)
  return (planned.length ? planned : open).sort(bySequence)[0]
}
