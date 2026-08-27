// Pipeline health — reading a week of movement out of the activity log.
//
// The portfolio view answers a different question from the project view. A
// project page asks "where is this deal"; this asks "what moved, and which
// way". So the unit here is not an event, it is a MOVEMENT: an event that
// carries a direction. An owner change and a two-week slip are both edits, but
// only one of them is news.
//
// Three rules shape this file:
//   1. DIRECTION IS THE POINT. Every movement is better / worse / neutral. A
//      feed that only says "12 things happened" makes a reader do the triage
//      the dashboard exists to do for them.
//   2. NOTHING IS RE-DERIVED. Slip, variance and the traffic light already live
//      in `workstreams.ts` and are computed from current state. This file reads
//      only what was *logged at the time*, so it can say what changed rather
//      than what is true now. The two are complementary and must not be mixed.
//   3. IT IS HONEST ABOUT ITS OWN HISTORY. Milestone and health logging began
//      2026-08-26 (R-1, closed with Workstreams). Before that date the log is
//      silent, and silence must not render as "nothing moved" — see
//      HISTORY_STARTS_AT.
//
// Nothing here writes.

import { PIPELINE_STAGES } from './stages'

/**
 * The day field-level change logging went live, portfolio-wide.
 *
 * `stage` / `deal_health` (`src/app/api/projects/[id]/route.ts`) and the
 * workstream write paths began logging from→to on this date. A window that
 * reaches back past it is not empty because nothing happened — it is empty
 * because nobody was writing it down, and the UI has to say which.
 */
export const HISTORY_STARTS_AT = '2026-08-26'

/** The raw shape this module consumes. Matches `activity_log` one-for-one. */
export interface ActivityRow {
  id: string
  entity_type: string
  entity_id: string
  action: string
  user_id: string | null
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null
}

export type MovementKind =
  | 'deal_health'
  | 'stage'
  | 'milestone_date'
  | 'milestone_status'
  | 'milestone_risk'
  | 'milestone_critical'
  | 'milestone_deleted'
  | 'gate_status'
  | 'major_completion'
  | 'weekly_update'

/**
 * Which way a movement points, from the portfolio's perspective.
 *
 * 'neutral' is a real answer, not a fallback for "don't know" — a weekly update
 * genuinely has no direction. Anything this module cannot classify is dropped
 * rather than shown as neutral, so neutral keeps its meaning.
 */
export type Direction = 'better' | 'worse' | 'neutral'

export interface Movement {
  /** the activity_log row id — stable, so it works as a React key */
  id: string
  projectId: string
  kind: MovementKind
  direction: Direction
  /**
   * Loudness, for ordering inside a direction. A deal going red outranks a
   * milestone slipping, which outranks a gate flipping. Slips scale with the
   * number of days so a 60-day move doesn't sort level with a 2-day one.
   */
  weight: number
  /** one line, past tense, no project name — the group header carries that */
  headline: string
  /** the supporting number or value pair, where there is one */
  detail: string | null
  at: string
  actorId: string | null
}

// ── ranking scales ────────────────────────────────────────────────────

/**
 * Deal health as an ordinal. TBD is deliberately absent: it is the absence of
 * an opinion, not a rung on the ladder, so a move into or out of TBD has no
 * direction and is classified neutral rather than invented as an improvement.
 */
const HEALTH_RANK: Record<string, number> = {
  'On Track': 0,
  'At Risk': 1,
  'Delayed': 2,
}

/**
 * Stage as an ordinal, using the pipeline order from `stages.ts` as the single
 * source of truth — a stage inserted there must not need a second edit here.
 *
 * Off-pipeline stages have no rank: 'On Hold' and 'Archived' are handled
 * explicitly below, because "paused" and "lost" are not points on the pipeline
 * and comparing them numerically would be meaningless.
 */
const STAGE_RANK = new Map<string, number>(PIPELINE_STAGES.map((s, i) => [s, i]))

const MILESTONE_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
  complete: 'Complete',
}

// ── date helpers ──────────────────────────────────────────────────────
// Same convention as workstreams.ts: DATE columns are calendar days, never
// instants. Parsing them through the local timezone shifts the day for anyone
// west of UTC, which would turn a same-day edit into a one-day slip.

const MS_PER_DAY = 86_400_000

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_PER_DAY
}

/** "2026-09-04" → "Sep 4". Undated reads as "no date", never as an empty cell. */
function shortDate(iso: string | null | undefined): string {
  if (!iso) return 'no date'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ── classification ────────────────────────────────────────────────────

/**
 * Turn one activity row into a movement, or null if it isn't one.
 *
 * Returning null is the common case and is not an error: most of what lands in
 * the activity log (owner changes, file uploads, mentions) is activity without
 * direction, and belongs in the project feed rather than here.
 */
export function toMovement(row: ActivityRow): Movement | null {
  const meta = row.metadata ?? {}
  const projectId: string | undefined = meta.project_id ?? (row.entity_type === 'project' ? row.entity_id : undefined)
  if (!projectId) return null

  const base = { id: row.id, projectId, at: row.created_at, actorId: row.user_id }

  // ── project-level: the two fields leadership actually steers by ──
  if (row.entity_type === 'project' && row.action === 'field_changed') {
    const from = meta.from == null ? null : String(meta.from)
    const to = meta.to == null ? null : String(meta.to)

    if (meta.field === 'deal_health') {
      const fromRank = from ? HEALTH_RANK[from] : undefined
      const toRank = to ? HEALTH_RANK[to] : undefined
      // A move involving TBD has no direction — see HEALTH_RANK.
      const direction: Direction =
        fromRank === undefined || toRank === undefined ? 'neutral'
          : toRank > fromRank ? 'worse'
            : toRank < fromRank ? 'better' : 'neutral'
      if (direction === 'neutral' && from === to) return null
      return {
        ...base,
        kind: 'deal_health',
        direction,
        // The loudest thing on the page: a human deliberately re-graded the deal.
        weight: 100 + (toRank ?? 0) * 5,
        headline: `Deal health set to ${to ?? 'TBD'}`,
        detail: from ? `was ${from}` : null,
      }
    }

    if (meta.field === 'stage') {
      const fromRank = from ? STAGE_RANK.get(from) : undefined
      const toRank = to ? STAGE_RANK.get(to) : undefined
      let direction: Direction = 'neutral'
      let weight = 60
      if (to === 'On Hold') { direction = 'worse'; weight = 95 }
      else if (from === 'On Hold') { direction = 'better'; weight = 80 }
      else if (to === 'Archived') { direction = 'worse'; weight = 98 }
      else if (fromRank !== undefined && toRank !== undefined) {
        // Advancing a stage is progress; going back means something was found
        // late enough to undo a phase, which is worth reading first.
        direction = toRank > fromRank ? 'better' : toRank < fromRank ? 'worse' : 'neutral'
        weight = toRank < fromRank ? 90 : 60
      }
      return {
        ...base,
        kind: 'stage',
        direction,
        weight,
        headline: `Stage moved to ${to ?? '—'}`,
        detail: from ? `from ${from}` : null,
      }
    }

    return null
  }

  if (row.entity_type !== 'workstream_milestone') return null

  const label: string = meta.label ?? 'A milestone'

  // ── milestone field changes ──
  if (row.action === 'field_changed') {
    const field = meta.field as string | undefined

    if (field === 'end_date') {
      const from = meta.from as string | null
      const to = meta.to as string | null
      // A date being set for the first time is planning, not movement — there
      // is no prior commitment for it to have moved against.
      if (!from || !to) {
        return {
          ...base,
          kind: 'milestone_date',
          direction: 'neutral',
          weight: 20,
          headline: `${label} target ${to ? 'set' : 'cleared'}`,
          detail: to ? shortDate(to) : null,
        }
      }
      const days = dayNumber(to) - dayNumber(from)
      if (days === 0) return null
      const slipped = days > 0
      return {
        ...base,
        kind: 'milestone_date',
        direction: slipped ? 'worse' : 'better',
        // Scaled by size, capped so one enormous re-plan can't bury a red deal.
        weight: (slipped ? 70 : 30) + Math.min(Math.abs(days), 30),
        headline: `${label} ${slipped ? 'slipped' : 'pulled in'} ${plural(Math.abs(days), 'day')}`,
        detail: `${shortDate(from)} → ${shortDate(to)}`,
      }
    }

    if (field === 'status') {
      const from = meta.from as string | null
      const to = meta.to as string | null
      if (from === to) return null
      const direction: Direction =
        to === 'blocked' ? 'worse'
          : to === 'complete' ? 'better'
            : from === 'blocked' ? 'better'
              : 'neutral'
      // Neutral status churn (not_started → in_progress) is ordinary work, and
      // the portfolio view is not where you watch work start.
      if (direction === 'neutral') return null
      return {
        ...base,
        kind: 'milestone_status',
        direction,
        weight: to === 'blocked' ? 85 : 40,
        headline: to === 'blocked'
          ? `${label} is blocked`
          : to === 'complete'
            ? `${label} completed`
            : `${label} unblocked`,
        detail: from ? `was ${MILESTONE_STATUS_LABEL[from] ?? from}` : null,
      }
    }

    if (field === 'risk') {
      // Logged as a transition only (see the milestones route): the body is rich
      // text that saves on every keystroke-pause, so only raised/cleared is news.
      const raised = !!meta.to
      return {
        ...base,
        kind: 'milestone_risk',
        direction: raised ? 'worse' : 'better',
        weight: raised ? 75 : 35,
        headline: `Risk ${raised ? 'flagged' : 'cleared'} on ${label}`,
        detail: null,
      }
    }

    if (field === 'is_critical') {
      const nowCritical = meta.to === true || meta.to === 'true'
      return {
        ...base,
        kind: 'milestone_critical',
        direction: nowCritical ? 'worse' : 'better',
        weight: nowCritical ? 55 : 25,
        headline: `${label} ${nowCritical ? 'added to' : 'removed from'} the critical path`,
        detail: null,
      }
    }

    // baseline_date, weight_pct, stage_gate: logged for the project feed, but
    // re-baselining is a planning decision rather than a week's movement.
    return null
  }

  if (row.action === 'gate_status_changed') {
    const to = meta.to as string | null
    const direction: Direction = to === 'fail' ? 'worse' : to === 'pass' ? 'better' : 'neutral'
    if (direction === 'neutral') return null
    return {
      ...base,
      kind: 'gate_status',
      direction,
      weight: to === 'fail' ? 80 : 45,
      headline: `${meta.kind === 'objective' ? 'Objective' : 'Exit gate'} ${to === 'fail' ? 'failed' : 'passed'}: ${label}`,
      detail: null,
    }
  }

  if (row.action === 'major_completed' || row.action === 'major_reopened') {
    const reopened = row.action === 'major_reopened'
    return {
      ...base,
      kind: 'major_completion',
      direction: reopened ? 'worse' : 'better',
      weight: reopened ? 82 : 50,
      headline: `${label} ${reopened ? 'reopened' : 'marked complete'}`,
      detail: null,
    }
  }

  if (row.action === 'milestone_deleted') {
    const unlinked = Number(meta.unlinked_tasks ?? 0)
    return {
      ...base,
      kind: 'milestone_deleted',
      direction: 'neutral',
      weight: 30,
      headline: `${label} deleted`,
      detail: unlinked > 0 ? `${plural(unlinked, 'task')} unlinked` : null,
    }
  }

  if (row.action === 'weekly_update_logged') {
    return {
      ...base,
      kind: 'weekly_update',
      direction: 'neutral',
      weight: 15,
      headline: 'Weekly update logged',
      detail: meta.workstream ? String(meta.workstream) : null,
    }
  }

  return null
}

/** Classify a batch, dropping everything that carries no direction. */
export function toMovements(rows: ActivityRow[]): Movement[] {
  return rows.map(toMovement).filter((m): m is Movement => m !== null)
}

// ── grouping ──────────────────────────────────────────────────────────

export interface ProjectMovements {
  projectId: string
  movements: Movement[]
  worse: number
  better: number
  neutral: number
  /**
   * The project's own direction for the week. A project with both a red flag
   * and a completed milestone reads 'worse': the bad news is the reason to
   * look, and netting them out would hide it.
   */
  direction: Direction
  /** loudest movement in the group, for ordering */
  topWeight: number
  /** most recent movement in the group */
  lastAt: string
}

/**
 * Group movements by project, worst first.
 *
 * Ordering is deliberately not chronological. A feed sorted by time asks the
 * reader to scan all of it to find the one project that went red; sorted by
 * direction then loudness, the first row on the page is the thing to deal with.
 */
export function groupByProject(movements: Movement[]): ProjectMovements[] {
  const byProject = new Map<string, Movement[]>()
  for (const m of movements) {
    const list = byProject.get(m.projectId)
    if (list) list.push(m)
    else byProject.set(m.projectId, [m])
  }

  const DIRECTION_RANK: Record<Direction, number> = { worse: 0, better: 1, neutral: 2 }

  const groups: ProjectMovements[] = []
  // Array.from rather than iterating the Map directly — the tsconfig target
  // predates downlevel Map iteration.
  for (const [projectId, list] of Array.from(byProject.entries())) {
    const sorted = [...list].sort((a, b) =>
      DIRECTION_RANK[a.direction] - DIRECTION_RANK[b.direction] ||
      b.weight - a.weight ||
      b.at.localeCompare(a.at))
    const worse = list.filter(m => m.direction === 'worse').length
    const better = list.filter(m => m.direction === 'better').length
    groups.push({
      projectId,
      movements: sorted,
      worse,
      better,
      neutral: list.length - worse - better,
      direction: worse > 0 ? 'worse' : better > 0 ? 'better' : 'neutral',
      topWeight: Math.max(...list.map(m => m.weight)),
      lastAt: list.reduce((a, m) => (m.at > a ? m.at : a), list[0].at),
    })
  }

  return groups.sort((a, b) =>
    DIRECTION_RANK[a.direction] - DIRECTION_RANK[b.direction] ||
    b.topWeight - a.topWeight ||
    b.lastAt.localeCompare(a.lastAt))
}

/** Portfolio counters for the header. */
export function summarize(groups: ProjectMovements[]) {
  return {
    projectsMoved: groups.length,
    projectsWorse: groups.filter(g => g.direction === 'worse').length,
    projectsBetter: groups.filter(g => g.direction === 'better').length,
    movements: groups.reduce((n, g) => n + g.movements.length, 0),
  }
}
