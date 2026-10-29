// Advancement — how far has this project got, and when did it last move?
//
// Both numbers come from ONE place: `workstream_milestones.completed_at`. That
// is deliberate, and it is the whole reason this module exists rather than the
// quadrant reusing momentum.
//
// Momentum is derived from `activity_log`, which cannot answer either question
// honestly:
//   · it holds no completion events at all — zero `major_completed` rows in the
//     table's history — so milestones finished by an import, a backfill, or any
//     path other than the API are invisible to it;
//   · a target date moving later scores NEGATIVE there, so a planning session
//     that re-dates a dozen milestones drives the score down. A project can be
//     penalised for planning.
// The result was three projects reading zero momentum three days after they
// completed milestones. A plan's own completion records have none of those
// failure modes: they are right regardless of how the work was recorded.
//
// Two rules shape this file:
//   1. COMPLETION IS THE ONLY EVIDENCE. Not events, not edits, not traffic —
//      a milestone marked complete, with the date it happened.
//   2. RECENCY IS BANDED, NOT LINEAR. The difference between 2 days and 9 days
//      is noise; the difference between 9 days and 9 weeks is the whole story.
//      See recencyScore.
//
// Nothing here writes.

import type { Milestone } from './workstreams'

/**
 * Past this many days without finishing anything, a project has stopped rather
 * than slowed. Matches STALE_DAYS in momentum.ts on purpose — two surfaces
 * disagreeing about when "quiet" begins would be worse than either threshold
 * being slightly wrong.
 */
export const RECENT_DAYS = 21

/**
 * Past this, the exact age stops carrying information: nine weeks and nine
 * months are the same answer. Points below it compress rather than running off
 * the bottom of the chart.
 */
export const COLD_DAYS = 63

const MS_PER_DAY = 86_400_000

export interface Advancement {
  /** 0-100: share of the plan's milestones complete. The horizontal axis. */
  score: number
  doneCount: number
  totalCount: number
  /** days since the most recent completion; null when nothing ever completed */
  daysSinceAdvance: number | null
  /** 0-100 placement for the vertical axis; 100 is today, 0 is cold or never */
  recency: number
}

/**
 * Place a gap in days on the 0-100 recency axis.
 *
 * Piecewise rather than linear so the midline lands exactly on RECENT_DAYS —
 * the chart's horizontal divider then means something nameable ("finished
 * something in the last three weeks") instead of an arbitrary halfway point.
 */
export function recencyScore(days: number | null): number {
  if (days === null) return 0
  if (days <= 0) return 100
  if (days <= RECENT_DAYS) return 100 - (days / RECENT_DAYS) * 50
  if (days >= COLD_DAYS) return 0
  return 50 - ((days - RECENT_DAYS) / (COLD_DAYS - RECENT_DAYS)) * 50
}

/**
 * Score one project's advancement from its own plan.
 *
 * `milestones` is the project's full set across every discipline — the question
 * is how much of the plan is behind it, so open work counts in the denominator.
 */
export function scoreAdvancement(milestones: Milestone[], now: number = Date.now()): Advancement {
  const totalCount = milestones.length
  const done = milestones.filter(m => m.status === 'complete')
  const doneCount = done.length

  // The most recent completion with a recorded date. A milestone marked
  // complete but carrying no `completed_at` still counts toward progress; it
  // just cannot date the advance.
  const latest = done.reduce<number | null>((max, m) => {
    if (!m.completed_at) return max
    const t = new Date(m.completed_at).getTime()
    return max === null || t > max ? t : max
  }, null)

  const daysSinceAdvance = latest === null
    ? null
    : Math.max(0, Math.floor((now - latest) / MS_PER_DAY))

  return {
    score: totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0,
    doneCount,
    totalCount,
    daysSinceAdvance,
    recency: Math.round(recencyScore(daysSinceAdvance)),
  }
}

/** How long ago it last moved, in words. */
export function lastAdvanceLabel(a: Advancement): string {
  if (a.daysSinceAdvance === null) return 'Never advanced'
  if (a.daysSinceAdvance === 0) return 'Advanced today'
  if (a.daysSinceAdvance === 1) return 'Advanced yesterday'
  return `Last advanced ${a.daysSinceAdvance} days ago`
}

/** One-line explanation, for the detail panel. */
export function advancementSummary(a: Advancement): string {
  if (a.totalCount === 0) return 'No plan milestones on this project.'
  if (a.doneCount === 0) return `Nothing completed yet — ${a.totalCount} milestones planned.`
  return `${a.doneCount} of ${a.totalCount} milestones complete. ${lastAdvanceLabel(a)}.`
}
