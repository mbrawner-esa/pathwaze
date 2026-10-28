// Advancement — how far has this project actually got?
//
// Momentum says whether anyone is DOING anything. Advancement says whether the
// project has got ANYWHERE. The two are independent, which is the whole reason
// the quadrant exists: a site can be busy and nowhere (mobilizing), or a long
// way along and silent (stalled), and no single score separates those.
//
// Three rules shape this file:
//   1. THE BAND IS THE FACT, THE NUMBER IS A PLACEMENT. Whether a project is
//      active, held-with-progress, or held-and-never-started is read straight
//      off the record. The 0-100 score only decides where inside its band the
//      dot sits, so the thresholds below are tunable without changing what any
//      project IS.
//   2. FINISHING SOMETHING IS THE GATE. An active project that has completed
//      nothing is mobilizing, not advancing, however busy it looks. That is the
//      one discontinuity in the scale and it is deliberate — see ACTIVE_NONE.
//   3. HELD PROJECTS KEEP WHAT THEY EARNED. Pausing a site does not undo its
//      plan. A held project with real progress sits above one that never
//      started, because those are different situations and the board's job is
//      to tell them apart.
//
// Nothing here writes.

import type { Milestone } from './workstreams'

export type AdvancementBand = 'active' | 'held_started' | 'not_started'

export const ADVANCEMENT_LABEL: Record<AdvancementBand, string> = {
  active: 'Active',
  held_started: 'Held, started',
  not_started: 'Not started',
}

/**
 * Band floors and spans.
 *
 * ACTIVE_FLOOR sits above the quadrant's own midline (50) so an advancing
 * project reads as advancing. ACTIVE_NONE sits below it: an active project that
 * has finished nothing belongs in the lower half, which is what "mobilizing"
 * means. The held band spans the lower-middle so a paused site with progress is
 * visibly distinct from the floor without ever being mistaken for live work.
 */
const ACTIVE_FLOOR = 55
const ACTIVE_SPAN = 45
const ACTIVE_NONE = 42
const HELD_FLOOR = 25
const HELD_SPAN = 25

export interface Advancement {
  /** 0-100; a placement inside the band, not a measurement */
  score: number
  band: AdvancementBand
  doneCount: number
  totalCount: number
  /** share of the plan complete, 0-1 */
  progress: number
}

/**
 * Score one project's advancement from its plan.
 *
 * `milestones` is the project's full set — every discipline, not the open ones,
 * because the question is how much of the plan is behind it. `held` is
 * `projects.on_hold_at`, which is the only thing that moves a project out of
 * the active band.
 */
export function scoreAdvancement(milestones: Milestone[], held: boolean): Advancement {
  const totalCount = milestones.length
  const doneCount = milestones.filter(m => m.status === 'complete').length
  const progress = totalCount > 0 ? doneCount / totalCount : 0

  let band: AdvancementBand
  let score: number

  if (!held) {
    // Rule 2 — nothing finished yet is a different state from early progress,
    // so it gets a fixed placement rather than the bottom of the active band.
    band = 'active'
    score = doneCount === 0 ? ACTIVE_NONE : ACTIVE_FLOOR + ACTIVE_SPAN * progress
  } else if (doneCount > 0) {
    band = 'held_started'
    score = HELD_FLOOR + HELD_SPAN * progress
  } else {
    band = 'not_started'
    score = 0
  }

  return { score: Math.round(score), band, doneCount, totalCount, progress }
}

/** One-line explanation, for a tooltip or the detail panel. */
export function advancementSummary(a: Advancement): string {
  if (a.totalCount === 0) return 'No plan milestones on this project.'
  const plan = `${a.doneCount} of ${a.totalCount} milestones complete`
  if (a.band === 'not_started') return `Held. Nothing started — ${plan}.`
  if (a.band === 'held_started') return `Held, with progress behind it — ${plan}.`
  return a.doneCount === 0
    ? `Active, nothing completed yet — ${a.totalCount} milestones planned.`
    : `Active — ${plan}.`
}
