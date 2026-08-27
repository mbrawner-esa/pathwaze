// Logic tests for src/lib/workstreams.ts.  Run:  npx jiti ./scripts/test-workstreams.ts
import {
  rollUpMajor, weightWarning, dateConflicts, derivedMajorDeps,
  nextMilestone, daysBetween, tasksByMilestone, buildThread,
  gateRequirements, varianceLabel, objectiveMark, suggestDealHealth, departmentsFor,
  nextMilestoneDetail,
  type Milestone, type MajorDef, type MilestoneDep, type LinkedTask,
  type WorkstreamActivity, type GateLink,
} from '../src/lib/workstreams'

let pass = 0, fail = 0
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want)
  if (g === w) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`) }
}

const ms = (o: Partial<Milestone> & { id: string; major_key: string }): Milestone => ({
  project_id: 'p1', label: o.id, description: null, stage_gate: null,
  weight_pct: 0, is_critical: false,
  end_date: null, baseline_date: null, status: 'not_started', completed_at: null,
  notes: null, risk: null, sort_order: 0,
  ...o,
})

const def = (key: string, ws: 'commercial' | 'technical' | 'approvals', order: number): MajorDef =>
  ({ key, workstream: ws, label: key, description: null, sort_order: order })

const task = (o: Partial<LinkedTask> & { id: string }): LinkedTask => ({
  title: o.id, status: 'Draft', assignee_id: null, due_date: null,
  completed_at: null, workstream_milestone_id: null,
  ...o,
})

console.log('\ndate helpers')
check('daysBetween inclusive', daysBetween('2026-08-01', '2026-08-31'), 31)
check('daysBetween same day', daysBetween('2026-08-24', '2026-08-24'), 1)
// A pre-DST date must not shift: parsed as calendar days, not local instants.
check('daysBetween across DST', daysBetween('2026-03-01', '2026-03-31'), 31)

console.log('\nrollUpMajor — window derives from milestone targets')
{
  const list = [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-06-30', status: 'complete' }),
    ms({ id: 'b', major_key: 'm1', end_date: '2026-09-30', status: 'in_progress' }),
    ms({ id: 'other', major_key: 'm2', end_date: '2020-01-02' }),
  ]
  const r = rollUpMajor(def('m1', 'technical', 1), list)
  check('start = earliest target', r.start, '2026-06-30')
  check('end = latest', r.end, '2026-09-30')
  check('ignores other majors', r.totalDays, daysBetween('2026-06-30', '2026-09-30'))
  check('counts', [r.doneCount, r.milestoneCount], [1, 2])
  check('status active', r.status, 'active')
}

console.log('\nrollUpMajor — status rules')
{
  const d = def('m1', 'technical', 1)
  check('no milestones -> upcoming', rollUpMajor(d, []).status, 'upcoming')
  check('no milestones -> 0%', rollUpMajor(d, []).pct, 0)
  check('all complete -> complete',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete' })]).status, 'complete')
  check('complete on baseline -> zero variance, on track',
    [rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete', end_date: '2020-01-01', baseline_date: '2020-01-01' })]).variance,
     rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete', end_date: '2020-01-01', baseline_date: '2020-01-01' })]).health],
    [0, 'on_track'])
  // Blocked is the only hand-set status that escalates a major. "At risk" is
  // gone from milestone status entirely — the dates express that now.
  check('blocked child escalates the major',
    rollUpMajor(d, [
      ms({ id: 'a', major_key: 'm1', status: 'in_progress' }),
      ms({ id: 'b', major_key: 'm1', status: 'blocked' }),
    ]).status, 'at_risk')
  check('future target -> upcoming',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2099-02-01' })]).status, 'upcoming')
  // A target already in the past with nothing marked is the case a status
  // field silently misses, so the dates escalate it on their own.
  check('past target -> at_risk (overdue)',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2020-01-01' })]).status, 'at_risk')
  check('overdue is counted',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2020-01-01' })]).overdueCount, 1)
  check('completed past target is not overdue',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2020-01-01', status: 'complete' })]).overdueCount, 0)
  check('undated open -> no variance and no light',
    [rollUpMajor(d, [ms({ id: 'a', major_key: 'm1' })]).variance,
     rollUpMajor(d, [ms({ id: 'a', major_key: 'm1' })]).health], [null, null])
  // The opposite of the old clamped figure: days-to-target must go negative, or
  // there is no way to say how late something is.
  check('past target goes negative, never clamped',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'in_progress', end_date: '2020-01-01' })]).daysToTarget! < 0, true)
}

console.log('\nrollUpMajor — weighted progress')
{
  const d = def('m1', 'commercial', 1)
  // unweighted falls back to equal weighting
  const equal = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', status: 'complete' }),
    ms({ id: 'b', major_key: 'm1' }),
    ms({ id: 'c', major_key: 'm1' }),
    ms({ id: 'e', major_key: 'm1' }),
  ])
  check('equal weighting when no weights', [equal.pct, equal.weighted], [25, false])

  // weights make one milestone count for more than its share of the count
  const weighted = rollUpMajor(d, [
    ms({ id: 'big', major_key: 'm1', weight_pct: 70, status: 'complete' }),
    ms({ id: 's1', major_key: 'm1', weight_pct: 15 }),
    ms({ id: 's2', major_key: 'm1', weight_pct: 15 }),
  ])
  check('weighted progress', [weighted.pct, weighted.weighted, weighted.weightTotal], [70, true, 100])

  // all complete always reads 100%, even when the weights are a bad plan
  const short = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', weight_pct: 30, status: 'complete' }),
    ms({ id: 'b', major_key: 'm1', weight_pct: 50, status: 'complete' }),
  ])
  check('all complete -> 100% despite weights summing to 80', short.pct, 100)
  check('but the bad total is reported', short.weightTotal, 80)

  // a partially-weighted major still uses weights (mixed is a plan in progress)
  const mixed = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', weight_pct: 50, status: 'complete' }),
    ms({ id: 'b', major_key: 'm1', weight_pct: 0 }),
  ])
  check('zero-weight milestone contributes nothing', mixed.pct, 100)
  check('decimal weights survive', rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', weight_pct: 33.33, status: 'complete' }),
    ms({ id: 'b', major_key: 'm1', weight_pct: 66.67 }),
  ]).pct, 33)
}

console.log('\nweightWarning')
{
  const d = def('m1', 'commercial', 1)
  const ok = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', weight_pct: 100 })])
  check('exactly 100 -> no warning', weightWarning(ok), null)
  check('unweighted -> no warning', weightWarning(rollUpMajor(d, [ms({ id: 'a', major_key: 'm1' })])), null)
  check('empty major -> no warning', weightWarning(rollUpMajor(d, [])), null)
  const under = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', weight_pct: 60 })])
  check('under 100 names the gap', weightWarning(under), 'Weights total 60% — 40% unassigned')
  const over = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', weight_pct: 80 }),
    ms({ id: 'b', major_key: 'm1', weight_pct: 40 }),
  ])
  check('over 100 names the excess', weightWarning(over), 'Weights total 120% — 20% over')
}

console.log('\ncritical path is user-declared, not derived')
{
  const d = def('m1', 'technical', 1)
  check('no flags -> false', rollUpMajor(d, [ms({ id: 'a', major_key: 'm1' })]).hasCritical, false)
  check('one flag -> true', rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1' }),
    ms({ id: 'b', major_key: 'm1', is_critical: true }),
  ]).hasCritical, true)
}

console.log('\ndateConflicts — successor due on or before its predecessor')
{
  const list = [
    ms({ id: 'p', major_key: 'm1', end_date: '2026-07-31' }),
    ms({ id: 'ok', major_key: 'm2', end_date: '2026-08-30' }),
    ms({ id: 'bad', major_key: 'm2', end_date: '2026-07-15' }),
    ms({ id: 'undated', major_key: 'm2' }),
  ]
  const deps: MilestoneDep[] = [
    { milestone_id: 'ok', depends_on: 'p' },
    { milestone_id: 'bad', depends_on: 'p' },
    { milestone_id: 'undated', depends_on: 'p' },
  ]
  const c = dateConflicts(list, deps)
  check('flags the overlap only', Array.from(c), ['bad'])
  check('undated is not a conflict', c.has('undated'), false)
  check('conflict surfaces on the major', rollUpMajor(def('m2', 'commercial', 1), list, c).hasDateConflict, true)
  check('clean major is unflagged', rollUpMajor(def('m1', 'commercial', 1), list, c).hasDateConflict, false)
}

console.log('\nderivedMajorDeps — milestone edges collapse to major edges')
{
  const list = [
    ms({ id: 'a1', major_key: 'A' }), ms({ id: 'a2', major_key: 'A' }),
    ms({ id: 'b1', major_key: 'B' }), ms({ id: 'b2', major_key: 'B' }),
  ]
  const deps: MilestoneDep[] = [
    { milestone_id: 'b1', depends_on: 'a1' },
    { milestone_id: 'b2', depends_on: 'a2' },  // duplicate A->B, must dedupe
    { milestone_id: 'a2', depends_on: 'a1' },  // within one major, must drop
  ]
  check('dedupes and drops self-edges', derivedMajorDeps(list, deps), [{ from: 'A', to: 'B' }])
}

console.log('\ntasks under milestones')
{
  const tasks = [
    task({ id: 't1', workstream_milestone_id: 'a', status: 'Complete', completed_at: '2026-08-01T00:00:00Z' }),
    task({ id: 't2', workstream_milestone_id: 'a', status: 'In Progress' }),
    task({ id: 't3', workstream_milestone_id: 'b', status: 'Complete', completed_at: '2026-08-20T00:00:00Z' }),
    task({ id: 'loose' }),   // not linked to any milestone
  ]
  const grouped = tasksByMilestone(tasks)
  check('groups by milestone', Array.from(grouped.keys()).sort(), ['a', 'b'])
  check('unlinked tasks excluded', grouped.has('loose'), false)
  check('milestone a has both its tasks', grouped.get('a')?.map(t => t.id), ['t1', 't2'])
}

console.log('\nslip against baseline')
{
  const d = def('m1', 'technical', 1)
  // On plan: target still matches the original commitment.
  const onPlan = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-09-30', baseline_date: '2026-09-30' }),
  ])
  check('no movement -> zero slip', onPlan.slipDays, 0)
  check('nothing slipped', onPlan.slippedCount, 0)

  // Late: the target has been pushed out past the baseline.
  const late = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-10-14', baseline_date: '2026-09-30' }),
  ])
  check('slip is measured in days', late.slipDays, 14)
  check('slipped milestone counted', late.slippedCount, 1)
  check('baseline is reported', late.baseline, '2026-09-30')

  // Pulled in: earlier than promised is not a risk, and must not read as one.
  const early = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-09-20', baseline_date: '2026-09-30' }),
  ])
  check('early slip is negative', early.slipDays, -10)
  check('early does not count as slipped', early.slippedCount, 0)

  // Slip is a major-level comparison: latest target vs latest baseline.
  const many = rollUpMajor(d, [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-08-01', baseline_date: '2026-08-01' }),
    ms({ id: 'b', major_key: 'm1', end_date: '2026-11-01', baseline_date: '2026-10-01' }),
  ])
  check('major slip uses the latest dates', many.slipDays, 31)
  check('only the moved one is counted', many.slippedCount, 1)

  check('no baseline -> no slip',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2026-09-30' })]).slipDays, null)
}

console.log('\nvariance + traffic light')
{
  const d = def('m1', 'technical', 1)
  const future = (days: number) => {
    const t = new Date(Date.now() + days * 86400000)
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
  }

  // On track: target untouched, plenty of room.
  const onTrack = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(30), baseline_date: future(30) })])
  check('room left -> positive variance', onTrack.variance, 30)
  check('room left -> green', onTrack.health, 'on_track')
  check('positive variance is signed', varianceLabel(onTrack.variance), '+30d')

  // At risk: target untouched but lands inside a week.
  const soon = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(5), baseline_date: future(5) })])
  check('within a week -> amber', soon.health, 'at_risk')
  check('within a week keeps a positive figure', soon.variance, 5)
  check('exactly 7 days is still amber',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(7), baseline_date: future(7) })]).health, 'at_risk')
  check('8 days is green',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(8), baseline_date: future(8) })]).health, 'on_track')

  // Delayed by slip: the target moved past its baseline, even though it is future.
  const slipped = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(40), baseline_date: future(20) })])
  check('slip -> negative variance', slipped.variance, -20)
  check('slip -> red even with room left', slipped.health, 'delayed')
  check('negative variance uses a minus sign', varianceLabel(slipped.variance), '\u221220d')

  // Delayed by overdue: never moved, but the date has passed.
  const overdue = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: '2020-01-01', baseline_date: '2020-01-01' })])
  check('overdue -> negative variance', overdue.variance! < 0, true)
  check('overdue -> red', overdue.health, 'delayed')

  // Pulled in: earlier than baseline is not a delay.
  const early = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(10), baseline_date: future(30) })])
  check('pulled-in target is not delayed', early.health, 'on_track')
  check('pulled in keeps days-to-target', early.variance, 10)
  // Pulled in but close: proximity still wins over the fact it was pulled in.
  check('pulled in but imminent is amber',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', end_date: future(3), baseline_date: future(30) })]).health, 'at_risk')

  // Complete: the figure becomes how it landed against baseline.
  const lateDone = rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete', end_date: '2026-09-18', baseline_date: '2026-08-30' })])
  check('completed late -> negative variance', lateDone.variance, -19)
  check('completed late -> red', lateDone.health, 'delayed')

  check('no target -> no light', rollUpMajor(d, [ms({ id: 'a', major_key: 'm1' })]).health, null)
  check('varianceLabel passes null through', varianceLabel(null), null)
  check('zero variance reads plainly', varianceLabel(0), '0d')
}

console.log('\ngateRequirements — cross-workstream links')
{
  const list = [
    ms({ id: 'tech1', major_key: 'design', status: 'complete' }),
    ms({ id: 'tech2', major_key: 'design' }),
    ms({ id: 'legal1', major_key: 'legal_review' }),
  ]
  const links: GateLink[] = [
    { gate_id: 'g1', milestone_id: 'tech1' },
    { gate_id: 'g1', milestone_id: 'tech2' },
    { gate_id: 'g2', milestone_id: 'legal1' },
    { gate_id: 'g1', milestone_id: 'ghost' },   // milestone since deleted
  ]
  const g1 = gateRequirements('g1', links, list)
  check('required milestones resolved', g1.required.map(m => m.id), ['tech1', 'tech2'])
  check('open = the incomplete ones', g1.open.map(m => m.id), ['tech2'])
  check('dangling link ignored', g1.required.some(m => m.id === 'ghost'), false)
  check('scoped per gate', gateRequirements('g2', links, list).required.map(m => m.id), ['legal1'])
  check('unlinked gate has nothing', gateRequirements('g3', links, list).required, [])
}

console.log('\nsuggestDealHealth — workstreams roll up to deal health')
{
  const dd = (k: string) => def(k, 'technical', 1)
  const future = (days: number) => {
    const t = new Date(Date.now() + days * 86400000)
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
  }
  const roll = (key: string, end: string | null, base: string | null, critical = false) =>
    rollUpMajor(dd(key), [ms({
      id: key + '-m', major_key: key, end_date: end, baseline_date: base, is_critical: critical,
    })])

  check('no dates -> TBD', suggestDealHealth([roll('a', null, null)]).value, 'TBD')
  check('no majors at all -> TBD', suggestDealHealth([]).value, 'TBD')

  check('all healthy -> On Track',
    suggestDealHealth([roll('a', future(60), future(60)), roll('b', future(90), future(90))]).value, 'On Track')

  check('one imminent -> At Risk',
    suggestDealHealth([roll('a', future(60), future(60)), roll('b', future(4), future(4))]).value, 'At Risk')

  // Worst child wins, the same rule a major uses for its own status.
  check('one delayed outranks several healthy -> Delayed',
    suggestDealHealth([roll('a', future(60), future(60)), roll('b', future(90), future(30))]).value, 'Delayed')

  check('delayed outranks at-risk',
    suggestDealHealth([roll('a', future(3), future(3)), roll('b', future(90), future(30))]).value, 'Delayed')

  // The reason should name what is driving it, not restate the verdict.
  const oneLate = suggestDealHealth([roll('a', future(90), future(30))])
  check('reports days behind', oneLate.reason.includes('60d'), true)
  check('driver is returned', oneLate.driver?.key, 'a')

  // A delay on the critical path is the one worth naming first.
  const both = suggestDealHealth([
    roll('nc', future(200), future(100)),
    roll('cp', future(60), future(40), true),
  ])
  check('critical path delay is named first', both.driver?.key, 'cp')

  // A finished major cannot drag the deal down, however late it landed.
  const doneLate = rollUpMajor(dd('done'), [ms({
    id: 'x', major_key: 'done', status: 'complete', end_date: '2020-03-01', baseline_date: '2020-01-01',
  })])
  check('completed majors are excluded',
    suggestDealHealth([doneLate, roll('b', future(60), future(60))]).value, 'On Track')
}

console.log('\non hold — the schedule stops driving anything')
{
  const d = def('m1', 'technical', 1)
  const past = [ms({ id: 'a', major_key: 'm1', end_date: '2020-01-01', baseline_date: '2019-01-01' })]

  // Running: an overdue milestone whose target also slipped past its baseline.
  const live = rollUpMajor(d, past)
  check('running -> escalates on the dates', live.status, 'at_risk')
  check('running -> has a light', live.health, 'delayed')
  check('running -> has variance', live.variance !== null, true)

  // Paused: the same data, but time passing is no longer a signal.
  const held = rollUpMajor(d, past, undefined, null, true)
  check('paused -> no traffic light', held.health, null)
  check('paused -> no variance', held.variance, null)
  check('paused -> dates do not escalate', held.status, 'upcoming')

  // Human-set status still counts: blocked is blocked whether or not the site
  // is parked. Only the DATE-driven signals are suspended.
  check('paused still respects blocked',
    rollUpMajor(d, [ms({ id: 'b', major_key: 'm1', status: 'blocked' })], undefined, null, true).status, 'at_risk')
  check('paused still completes',
    rollUpMajor(d, [ms({ id: 'c', major_key: 'm1', status: 'complete' })], undefined, null, true).status, 'complete')

  // Baselines are untouched — the record of the original commitment survives.
  check('paused keeps the baseline visible', held.baseline, '2019-01-01')

  // And the deal-health suggestion stops having an opinion.
  const paused = suggestDealHealth([live], true)
  check('paused deal health -> TBD', paused.value, 'TBD')
  check('paused deal health explains why', paused.reason.includes('on hold'), true)
  check('running deal health still judges', suggestDealHealth([live], false).value, 'Delayed')
}

console.log('\ndepartmentsFor — team tags')
{
  const departments = [
    { key: 'engineering', name: 'Engineering', sort_order: 3 },
    { key: 'asset_management', name: 'Asset Management', sort_order: 2 },
    { key: 'gis', name: 'GIS', sort_order: 6 },
  ]
  const tags = [
    { milestone_id: 'm1', department_key: 'gis' },
    { milestone_id: 'm1', department_key: 'asset_management' },
    { milestone_id: 'm2', department_key: 'engineering' },
    { task_id: 't1', department_key: 'engineering' },
  ]

  // Catalog order, not tag order: the list should read the same everywhere.
  check('returns catalog order', departmentsFor('m1', tags, departments).map(x => x.key),
    ['asset_management', 'gis'])
  check('scoped per milestone', departmentsFor('m2', tags, departments).map(x => x.key), ['engineering'])
  check('untagged milestone -> empty', departmentsFor('m3', tags, departments), [])
  // Task tags live in the same shape but must not bleed into milestone lookups.
  check('task tags excluded from milestone lookup',
    departmentsFor('t1', tags, departments), [])
  check('task lookup works when asked',
    departmentsFor('t1', tags, departments, 'task_id').map(x => x.key), ['engineering'])
}

console.log('\nobjectiveMark — emoji instead of 1/2/3')
{
  check('stable per position', objectiveMark(0), objectiveMark(0))
  check('adjacent marks differ', objectiveMark(0) === objectiveMark(1), false)
  check('wraps rather than running out', typeof objectiveMark(99), 'string')
  check('never empty', objectiveMark(99).length > 0, true)
}

console.log('\nmanual completion override')
{
  const d = def('m1', 'technical', 1)
  const open = [
    ms({ id: 'a', major_key: 'm1', status: 'complete', weight_pct: 40 }),
    ms({ id: 'b', major_key: 'm1', status: 'blocked', weight_pct: 60 }),
  ]
  const derived = rollUpMajor(d, open)
  check('without override, blocked wins', [derived.status, derived.pct], ['at_risk', 40])

  const forced = rollUpMajor(d, open, undefined, '2026-08-25T00:00:00Z')
  check('override forces complete', forced.status, 'complete')
  check('override forces 100%', forced.pct, 100)
  check('override is flagged', forced.manuallyCompleted, true)
  check('open work underneath is counted', forced.openUnderOverride, 1)
  check('override reads complete', forced.status, 'complete')
  check('derived completion is not flagged as manual',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete' })]).manuallyCompleted, false)
  check('no open work when everything is done',
    rollUpMajor(d, [ms({ id: 'a', major_key: 'm1', status: 'complete' })], undefined, '2026-08-25T00:00:00Z').openUnderOverride, 0)
  // An override on an empty major is legitimate: a stage that needed no plan.
  check('override works with no milestones',
    rollUpMajor(d, [], undefined, '2026-08-25T00:00:00Z').status, 'complete')
}

console.log('\nnextMilestone skips manually-completed majors')
{
  const defs = [def('m1', 'commercial', 1), def('m2', 'technical', 1)]
  const list = [
    ms({ id: 'a', major_key: 'm1', end_date: '2026-09-01' }),
    ms({ id: 'b', major_key: 'm2', end_date: '2026-10-01' }),
  ]
  check('without override, soonest wins', nextMilestone(defs, list)?.key, 'm1')
  check('override on m1 promotes m2',
    nextMilestone(defs, list, [{ major_key: 'm1', completed_at: '2026-08-25T00:00:00Z' }])?.key, 'm2')
  check('all overridden -> null',
    nextMilestone(defs, list, [
      { major_key: 'm1', completed_at: '2026-08-25T00:00:00Z' },
      { major_key: 'm2', completed_at: '2026-08-25T00:00:00Z' },
    ]), null)
  check('null completed_at is not an override',
    nextMilestone(defs, list, [{ major_key: 'm1', completed_at: null }])?.key, 'm1')
}

console.log('\nbuildThread — updates + completed tasks + events, newest first')
{
  const list = [ms({ id: 'x', major_key: 'M' }), ms({ id: 'z', major_key: 'OTHER' })]
  const updates = [
    { id: 'u1', body: '<p>Week 1</p>', created_at: '2026-08-10T00:00:00Z', created_by: 'mb', major_key: 'M' },
    { id: 'u2', body: '<p>Other major</p>', created_at: '2026-08-11T00:00:00Z', created_by: 'mb', major_key: 'OTHER' },
  ]
  const tasks = [
    task({ id: 't1', workstream_milestone_id: 'x', status: 'Complete', completed_at: '2026-08-15T00:00:00Z' }),
    task({ id: 't2', workstream_milestone_id: 'x', status: 'In Progress' }),
    task({ id: 't3', workstream_milestone_id: 'x', status: 'Complete', completed_at: null }),
  ]
  const activity: WorkstreamActivity[] = [
    { id: 'a1', action: 'gate_status_changed', created_at: '2026-08-20T00:00:00Z', user_id: 'sc',
      metadata: { major_key: 'M', project_id: 'p1', label: 'Permit issued', to: 'pass' } },
    { id: 'a2', action: 'weekly_update_logged', created_at: '2026-08-10T00:00:00Z', user_id: 'mb',
      metadata: { major_key: 'M', project_id: 'p1' } },
    { id: 'a3', action: 'field_changed', created_at: '2026-08-05T00:00:00Z', user_id: 'jw',
      metadata: { major_key: 'M', project_id: 'p1', field: 'status', label: 'Survey', to: 'complete' } },
    { id: 'a4', action: 'field_changed', created_at: '2026-08-04T00:00:00Z', user_id: 'jw',
      metadata: { major_key: 'M', project_id: 'p1', field: 'notes', label: 'Survey' } },
    { id: 'a5', action: 'gate_added', created_at: '2026-08-01T00:00:00Z', user_id: 'mb',
      metadata: { major_key: 'OTHER', project_id: 'p1', label: 'Elsewhere' } },
  ]

  const t = buildThread({ updates, tasks, milestones: list, activity, majorKey: 'M' })
  check('newest first', t.map(i => i.at.slice(0, 10)), ['2026-08-20', '2026-08-15', '2026-08-10', '2026-08-05'])
  check('kinds interleave', t.map(i => i.kind), ['event', 'task', 'update', 'event'])
  check('scoped to the major', t.some(i => i.kind === 'update' && i.body.includes('Other')), false)
  check('other majors excluded', t.some(i => i.id === 'a-a5'), false)
  // weekly_update_logged would double up the written update, so it is dropped.
  check('no duplicate for the written update', t.filter(i => i.at === '2026-08-10T00:00:00Z').length, 1)
  check('noise fields dropped (notes edit)', t.some(i => i.id === 'a-a4'), false)
  check('incomplete task excluded', t.some(i => i.kind === 'task' && i.id === 't-t2'), false)
  // A Complete task with no timestamp can't be placed in time, so it is skipped.
  check('completed task without a date excluded', t.some(i => i.id === 't-t3'), false)
  check('gate pass reads as good news',
    t.find(i => i.id === 'a-a1' && i.kind === 'event') && (t[0] as { tone: string }).tone, 'good')
  check('empty major -> empty thread',
    buildThread({ updates: [], tasks: [], milestones: list, activity: [], majorKey: 'M' }), [])
  check('limit respected',
    buildThread({ updates, tasks, milestones: list, activity, majorKey: 'M', limit: 2 }).length, 2)
}

console.log('\nnextMilestoneDetail — what is being worked, else nearest baseline')
{
  const defs2 = [def('m1', 'commercial', 1), def('m2', 'technical', 1)]

  // Work in flight wins over a nearer date elsewhere: what the team is on beats
  // what the calendar says is next.
  const working = [
    ms({ id: 'soon', major_key: 'm1', baseline_date: '2026-09-01' }),
    ms({ id: 'active', major_key: 'm2', baseline_date: '2026-12-01', status: 'in_progress' }),
  ]
  check('in-progress beats a nearer baseline', nextMilestoneDetail(defs2, working)?.milestone.id, 'active')
  check('carries its major label', nextMilestoneDetail(defs2, working)?.majorLabel, 'm2')

  // Blocked still counts as being worked — it is the thing occupying someone.
  check('blocked counts as in flight', nextMilestoneDetail(defs2, [
    ms({ id: 'soon', major_key: 'm1', baseline_date: '2026-09-01' }),
    ms({ id: 'stuck', major_key: 'm2', baseline_date: '2026-12-01', status: 'blocked' }),
  ])?.milestone.id, 'stuck')

  // Nothing in flight: nearest BASELINE, not nearest target. Ordering by target
  // would let a slipping milestone drop down the queue as it slips.
  const idle = [
    ms({ id: 'later-baseline', major_key: 'm1', baseline_date: '2026-11-01', end_date: '2026-09-05' }),
    ms({ id: 'nearer-baseline', major_key: 'm2', baseline_date: '2026-10-01', end_date: '2027-01-01' }),
  ]
  check('falls back to nearest baseline', nextMilestoneDetail(defs2, idle)?.milestone.id, 'nearer-baseline')

  check('undated sort behind dated', nextMilestoneDetail(defs2, [
    ms({ id: 'undated', major_key: 'm1' }),
    ms({ id: 'dated', major_key: 'm2', baseline_date: '2027-06-01' }),
  ])?.milestone.id, 'dated')

  check('completed milestones are skipped', nextMilestoneDetail(defs2, [
    ms({ id: 'done', major_key: 'm1', baseline_date: '2026-01-01', status: 'complete' }),
    ms({ id: 'open', major_key: 'm2', baseline_date: '2026-09-01' }),
  ])?.milestone.id, 'open')

  check('nothing open -> null', nextMilestoneDetail(defs2, [
    ms({ id: 'done', major_key: 'm1', status: 'complete' }),
  ]), null)

  // A hand-closed major takes its milestones out of the running.
  check('manually completed major is skipped', nextMilestoneDetail(defs2, [
    ms({ id: 'inClosed', major_key: 'm1', baseline_date: '2026-01-01' }),
    ms({ id: 'open', major_key: 'm2', baseline_date: '2026-09-01' }),
  ], [{ major_key: 'm1', completed_at: '2026-08-01T00:00:00Z' }])?.milestone.id, 'open')

  check('no dates anywhere still names something',
    nextMilestoneDetail(defs2, [ms({ id: 'a', major_key: 'm1' }), ms({ id: 'b', major_key: 'm2' })])?.milestone.id, 'a')
}

console.log('\nnextMilestone')
{
  const defs = [def('m1', 'commercial', 1), def('m2', 'technical', 1), def('m3', 'approvals', 1)]
  const list = [
    ms({ id: 'a', major_key: 'm1', status: 'complete', end_date: '2026-01-01' }),
    ms({ id: 'b', major_key: 'm2', end_date: '2026-12-01' }),
    ms({ id: 'c', major_key: 'm3', end_date: '2026-09-01' }),
  ]
  check('soonest open deadline wins across workstreams', nextMilestone(defs, list)?.key, 'm3')
  check('skips complete majors', nextMilestone(defs, list)?.status !== 'complete', true)
  check('all complete -> null',
    nextMilestone([def('m1', 'commercial', 1)], [ms({ id: 'a', major_key: 'm1', status: 'complete' })]), null)
  check('undated prefers a major with planned work',
    nextMilestone(defs, [ms({ id: 'b', major_key: 'm2' }), ms({ id: 'c', major_key: 'm3' })])?.key, 'm2')
  check('no milestones anywhere -> first in catalog sequence', nextMilestone(defs, [])?.key, 'm1')
  // sort_order restarts per workstream, so ranking must not depend on query order.
  const shuffled = [def('m3', 'approvals', 1), def('m1', 'commercial', 1), def('m2', 'technical', 1)]
  check('order is independent of defs array order', nextMilestone(shuffled, [])?.key, 'm1')
  const seq = [def('x2', 'commercial', 2), def('x1', 'commercial', 1)]
  check('within a workstream sort_order decides', nextMilestone(seq, [])?.key, 'x1')
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
