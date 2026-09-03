// Momentum — is this project actually moving?
//
// Health says whether the dates still hold. Momentum says something health
// cannot: whether anyone is DOING anything. The two disagree in exactly the
// case worth catching — a project sitting comfortably on-track because its
// targets are all months away, which nobody has touched in a month.
//
// Three rules shape this file:
//   1. RECENT SILENCE OUTWEIGHS AN OLD BURST. A flurry of work three weeks ago
//      does not make a project active today, so staleness caps the score rather
//      than being averaged into it (see STALE_DAYS).
//   2. CRITICAL-PATH WORK COUNTS DOUBLE. Effort on the chain that actually
//      determines the finish date is worth more than effort beside it — that is
//      what the critical-path flag is for.
//   3. THE SCORE MUST BE EXPLAINABLE. Every point is attributable to a named
//      component, so "why is this a 34?" has a real answer in a tooltip rather
//      than being a black box.
//
// Nothing here writes.

import type { Milestone } from './workstreams'

/** Trailing window. Long enough to survive a quiet week, short enough to be current. */
export const WINDOW_DAYS = 30

/**
 * Silence past this many days caps the score into the stalled band, whatever
 * the points say. Three weeks is roughly two missed weekly updates — by then a
 * project is not slow, it is stopped.
 */
export const STALE_DAYS = 21

/**
 * Points that map to a full score. Chosen so a project completing a couple of
 * milestones and a handful of tasks in a month reads as strong, rather than
 * needing an implausible burst to reach 100. Tune this number, not the weights,
 * if the whole portfolio reads too hot or too cold.
 */
const FULL_SCORE_POINTS = 24

export type MomentumBand = 'stalled' | 'slow' | 'steady' | 'strong'

export const BAND_LABEL: Record<MomentumBand, string> = {
  stalled: 'Stalled',
  slow: 'Slow',
  steady: 'Steady',
  strong: 'Strong',
}

export const BAND_COLOR: Record<MomentumBand, { fg: string; bg: string }> = {
  stalled: { fg: '#991B1B', bg: '#FEF2F2' },
  slow:    { fg: '#92400E', bg: '#FEF0C7' },
  steady:  { fg: '#8A6519', bg: '#FDF0D5' },
  strong:  { fg: '#166534', bg: '#DCFCE7' },
}

export interface MomentumComponent {
  label: string
  count: number
  points: number
}

export interface Momentum {
  /** 0-100 */
  score: number
  band: MomentumBand
  /** null when the project has no recorded activity at all */
  daysSinceActivity: number | null
  /** true when staleness pulled the score down from what the points alone gave */
  stale: boolean
  components: MomentumComponent[]
}

/** The activity_log subset this module reads. */
export interface ActivityEvent {
  entity_type: string
  entity_id: string
  action: string
  created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> | null
}

export interface CompletedTask {
  project_id: string | null
  completed_at: string | null
  workstream_milestone_id: string | null
}

const MS_PER_DAY = 86_400_000

/**
 * Base weights. Completing something outranks talking about it; advancing a
 * stage outranks both, because a stage only moves when a real gate has cleared.
 */
const WEIGHT = {
  stageAdvanced: 5,
  milestoneCompleted: 3,
  taskCompleted: 1,
  statusMoved: 1.5,
  weeklyUpdate: 1,
  /** A slip is real news, but it is movement in the wrong direction. */
  slipped: -2,
}

/** Doubling factor for anything touching a critical-path milestone (rule 2). */
const CRITICAL_MULTIPLIER = 2

function daysAgo(iso: string, now: number): number {
  return (now - new Date(iso).getTime()) / MS_PER_DAY
}

/**
 * Score one project's momentum from its recent activity.
 *
 * `events` should already be filtered to this project and to the window;
 * `milestones` is the project's full set, used only to know which ids are on
 * the critical path.
 */
export function scoreMomentum(
  events: ActivityEvent[],
  tasks: CompletedTask[],
  milestones: Milestone[],
  now: number = Date.now(),
): Momentum {
  const criticalIds = new Set(milestones.filter(m => m.is_critical).map(m => m.id))
  const cutoff = now - WINDOW_DAYS * MS_PER_DAY

  const recent = events.filter(e => new Date(e.created_at).getTime() >= cutoff)

  let stageAdvanced = 0
  let milestoneCompleted = 0
  let statusMoved = 0
  let weeklyUpdate = 0
  let slipped = 0
  let criticalTouches = 0

  for (const e of recent) {
    const onCritical = criticalIds.has(e.entity_id)
    if (onCritical) criticalTouches++

    if (e.entity_type === 'project' && e.action === 'field_changed' && e.metadata?.field === 'stage') {
      stageAdvanced++
      continue
    }
    if (e.entity_type !== 'workstream_milestone') continue

    if (e.action === 'weekly_update_logged') { weeklyUpdate++; continue }
    if (e.action === 'major_completed') { milestoneCompleted++; continue }

    if (e.action === 'field_changed') {
      if (e.metadata?.field === 'status') {
        if (e.metadata?.to === 'complete') milestoneCompleted++
        else statusMoved++
      } else if (e.metadata?.field === 'end_date') {
        // A target moving later is a slip; moving earlier is a pull-in and is
        // simply not counted — momentum should not reward re-planning.
        const from = e.metadata?.from as string | null
        const to = e.metadata?.to as string | null
        if (from && to && to.slice(0, 10) > from.slice(0, 10)) slipped++
      }
    }
  }

  const taskCompleted = tasks.filter(t =>
    t.completed_at && new Date(t.completed_at).getTime() >= cutoff).length
  const criticalTaskCompleted = tasks.filter(t =>
    t.completed_at && new Date(t.completed_at).getTime() >= cutoff
    && t.workstream_milestone_id && criticalIds.has(t.workstream_milestone_id)).length

  // Critical work counts double. Applied as a bonus on the critical share
  // rather than by re-weighting each event, so the components stay readable.
  const criticalBonus = (criticalTouches * WEIGHT.statusMoved
    + criticalTaskCompleted * WEIGHT.taskCompleted) * (CRITICAL_MULTIPLIER - 1)

  const components: MomentumComponent[] = [
    { label: 'Stage advanced',      count: stageAdvanced,      points: stageAdvanced * WEIGHT.stageAdvanced },
    { label: 'Milestones completed', count: milestoneCompleted, points: milestoneCompleted * WEIGHT.milestoneCompleted },
    { label: 'Tasks completed',     count: taskCompleted,      points: taskCompleted * WEIGHT.taskCompleted },
    { label: 'Status changes',      count: statusMoved,        points: statusMoved * WEIGHT.statusMoved },
    { label: 'Weekly updates',      count: weeklyUpdate,       points: weeklyUpdate * WEIGHT.weeklyUpdate },
    { label: 'Critical-path work',  count: criticalTouches,    points: Math.round(criticalBonus * 10) / 10 },
    { label: 'Milestones slipped',  count: slipped,            points: slipped * WEIGHT.slipped },
  ].filter(c => c.count > 0)

  const points = components.reduce((sum, c) => sum + c.points, 0)
  const fromPoints = Math.max(0, Math.min(100, Math.round((points / FULL_SCORE_POINTS) * 100)))

  // Staleness. Measured against ALL events, not just in-window ones, so a
  // project quiet for two months reports the true gap rather than ">30 days".
  const latest = events.reduce<number | null>((max, e) => {
    const t = new Date(e.created_at).getTime()
    return max === null || t > max ? t : max
  }, null)
  const daysSinceActivity = latest === null ? null : Math.floor(daysAgo(new Date(latest).toISOString(), now))

  // Rule 1 — silence caps the score rather than averaging into it.
  const stale = daysSinceActivity === null || daysSinceActivity >= STALE_DAYS
  const score = stale ? Math.min(fromPoints, 15) : fromPoints

  return {
    score,
    band: bandFor(score),
    daysSinceActivity,
    stale: stale && fromPoints > 15,
    components,
  }
}

/** Score → band. Thresholds are deliberately wide; this is a signal, not a metric. */
export function bandFor(score: number): MomentumBand {
  if (score >= 70) return 'strong'
  if (score >= 40) return 'steady'
  if (score >= 16) return 'slow'
  return 'stalled'
}

/** One-line explanation for a tooltip. */
export function momentumSummary(m: Momentum): string {
  if (!m.components.length) {
    return m.daysSinceActivity === null
      ? 'No recorded activity on this project.'
      : `Nothing in the last ${WINDOW_DAYS} days. Last activity ${m.daysSinceActivity}d ago.`
  }
  const parts = m.components.map(c => `${c.label}: ${c.count}`).join(' · ')
  const tail = m.stale
    ? ` Capped — last activity ${m.daysSinceActivity}d ago.`
    : ''
  return `${parts}.${tail}`
}
