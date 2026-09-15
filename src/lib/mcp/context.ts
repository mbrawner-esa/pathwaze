/**
 * Full-fidelity context assembly: every note, message, task, stage and thread
 * the requesting user is allowed to see.
 *
 * Nothing is summarised. What narrows the result is RLS, not this code — a team
 * member and an admin run identical queries and simply get different rows.
 *
 * Ported from the local stdio server's context.mjs.
 */
import { get, resolveProject, userMap, nameOf, BIG, type Filter } from './query'
import type { McpSession } from './auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

const byProject = (s: McpSession, table: string, projectId: string, opts = {}) =>
  get(s, table, { filters: [{ column: 'project_id', value: projectId }], limit: BIG, ...opts })

const byIn = (s: McpSession, table: string, column: string, ids: string[], opts = {}) =>
  ids.length
    ? get(s, table, {
        filters: [{ column, op: 'in', value: ids } as Filter],
        limit: BIG,
        ...opts,
      })
    : Promise.resolve([] as Row[])

const group = (rows: Row[], key: string): Record<string, Row[]> => {
  const out: Record<string, Row[]> = {}
  for (const r of rows) (out[r[key]] ||= []).push(r)
  return out
}

const none = () => [] as Row[]

export async function projectContext(
  session: McpSession,
  ref: string,
  { include_activity = true }: { include_activity?: boolean } = {}
) {
  const project = await resolveProject(session, ref)
  const pid = project.id as string
  const users = await userMap(session)

  const [
    financials, notes, threads, tasks, stakeholders, buildings, meters, systems,
    permits, pricing, pricingThreads, drawings, rfis, milestones, majorState,
    gates, updates, risk, priority, dataroom,
  ] = await Promise.all([
    byProject(session, 'project_financials', pid).catch(none),
    byProject(session, 'project_notes', pid, { order: 'created_at.asc' }),
    byProject(session, 'project_threads', pid, { order: 'created_at.asc' }),
    byProject(session, 'tasks', pid, { order: 'created_at.asc' }),
    byProject(session, 'stakeholders', pid),
    byProject(session, 'buildings', pid),
    byProject(session, 'meters', pid),
    byProject(session, 'systems', pid),
    byProject(session, 'permits', pid),
    byProject(session, 'offtaker_pricing', pid, { order: 'created_at.asc' }),
    byProject(session, 'offtaker_pricing_threads', pid, { order: 'created_at.asc' }).catch(none),
    byProject(session, 'drawings', pid),
    byProject(session, 'rfis', pid, { order: 'rfi_number.asc' }),
    byProject(session, 'workstream_milestones', pid, { order: 'sort_order.asc' }),
    byProject(session, 'workstream_major_state', pid),
    byProject(session, 'workstream_gates', pid, { order: 'sort_order.asc' }),
    byProject(session, 'workstream_updates', pid, { order: 'created_at.asc' }),
    byProject(session, 'project_risk', pid).catch(none),
    byProject(session, 'portfolio_priority', pid).catch(none),
    byProject(session, 'dataroom_docs', pid).catch(none),
  ])

  const taskIds = tasks.map((t) => t.id)
  const rfiIds = rfis.map((r) => r.id)
  const msIds = milestones.map((m) => m.id)
  const drawingIds = drawings.map((d) => d.id)
  const stakeholderIds = stakeholders.map((s) => s.id)
  const gateIds = gates.map((g) => g.id)
  const permitIds = permits.map((p) => p.id)

  const [
    taskThreads, taskFiles, taskLinks, taskDepts,
    rfiResponses, rfiDistribution, rfiLinks, rfiAttachments,
    msComments, msDeps, msDepts, msFocus,
    gateLinks, stakeholderTodos, reviews, permitAttachments, majors, departments,
  ] = await Promise.all([
    byIn(session, 'task_threads', 'task_id', taskIds, { order: 'created_at.asc' }),
    byIn(session, 'task_files', 'task_id', taskIds).catch(none),
    byIn(session, 'task_links', 'task_id', taskIds).catch(none),
    byIn(session, 'task_departments', 'task_id', taskIds).catch(none),
    byIn(session, 'rfi_responses', 'rfi_id', rfiIds, { order: 'created_at.asc' }),
    byIn(session, 'rfi_distribution', 'rfi_id', rfiIds).catch(none),
    byIn(session, 'rfi_links', 'rfi_id', rfiIds).catch(none),
    byIn(session, 'rfi_attachments', 'rfi_id', rfiIds).catch(none),
    byIn(session, 'workstream_milestone_comments', 'milestone_id', msIds, { order: 'created_at.asc' }).catch(none),
    byIn(session, 'workstream_milestone_deps', 'milestone_id', msIds).catch(none),
    byIn(session, 'workstream_milestone_departments', 'milestone_id', msIds).catch(none),
    byIn(session, 'workstream_milestone_focus', 'milestone_id', msIds).catch(none),
    byIn(session, 'workstream_gate_links', 'gate_id', gateIds).catch(none),
    byIn(session, 'stakeholder_tasks', 'stakeholder_id', stakeholderIds).catch(none),
    byIn(session, 'drawing_reviews', 'drawing_id', drawingIds).catch(none),
    byIn(session, 'permit_attachments', 'permit_id', permitIds).catch(none),
    get(session, 'workstream_majors', { limit: BIG, order: 'sort_order.asc' }),
    get(session, 'departments', { limit: BIG, order: 'sort_order.asc' }).catch(none),
  ])

  const reviewIds = reviews.map((r) => r.id)
  const [findings, reviewComments] = await Promise.all([
    byIn(session, 'review_findings', 'drawing_review_id', reviewIds).catch(none),
    byIn(session, 'review_comments', 'drawing_review_id', reviewIds).catch(none),
  ])

  const activity = include_activity
    ? await get(session, 'activity_log', {
        filters: [
          { column: 'entity_id', op: 'in', value: [pid, ...taskIds, ...rfiIds].slice(0, 300) } as Filter,
        ],
        order: 'created_at.desc',
        limit: BIG,
      }).catch(none)
    : []

  // ---- stitch children onto parents -------------------------------------
  const tt = group(taskThreads, 'task_id')
  const tf = group(taskFiles, 'task_id')
  const tl = group(taskLinks, 'task_id')
  const td = group(taskDepts, 'task_id')
  const byParent = group(tasks.filter((t) => t.parent_task_id), 'parent_task_id')

  const fatTasks: Row[] = tasks.map((t) => ({
    ...t,
    assignee: nameOf(users, t.assignee_id),
    approver: nameOf(users, t.approver_id),
    created_by_name: nameOf(users, t.created_by),
    messages: (tt[t.id] || []).map((m) => ({ ...m, author: nameOf(users, m.user_id) })),
    files: tf[t.id] || [],
    links: tl[t.id] || [],
    departments: td[t.id] || [],
    subtasks: (byParent[t.id] || []).map((s) => ({ id: s.id, title: s.title, status: s.status })),
  }))

  const rr = group(rfiResponses, 'rfi_id')
  const rd = group(rfiDistribution, 'rfi_id')
  const rl = group(rfiLinks, 'rfi_id')
  const ra = group(rfiAttachments, 'rfi_id')
  const fatRfis = rfis.map((r) => ({
    ...r,
    ball_in_court: nameOf(users, r.ball_in_court_user_id),
    rfi_manager: nameOf(users, r.rfi_manager_id),
    responses: rr[r.id] || [],
    distribution: rd[r.id] || [],
    links: rl[r.id] || [],
    attachments: ra[r.id] || [],
  }))

  const mc = group(msComments, 'milestone_id')
  const md = group(msDeps, 'milestone_id')
  const mdep = group(msDepts, 'milestone_id')
  const stateByKey = Object.fromEntries(majorState.map((s) => [s.major_key, s]))
  const msByMajor = group(milestones, 'major_key')
  const gatesByMajor = group(gates, 'major_key')
  const updatesByMajor = group(updates, 'major_key')

  const workstreams = majors
    .map((maj) => {
      const st = stateByKey[maj.key]
      return {
        key: maj.key,
        workstream: maj.workstream,
        label: maj.label,
        description: maj.description,
        state: st
          ? { ...st, owner: nameOf(users, st.owner_id), co_owner: nameOf(users, st.co_owner_id) }
          : null,
        milestones: (msByMajor[maj.key] || []).map((m) => ({
          ...m,
          created_by_name: nameOf(users, m.created_by),
          comments: (mc[m.id] || []).map((c) => ({ ...c, author: nameOf(users, c.user_id) })),
          depends_on: md[m.id] || [],
          departments: mdep[m.id] || [],
          focus: msFocus.filter((f) => f.milestone_id === m.id),
          tasks: fatTasks
            .filter((t) => t.workstream_milestone_id === m.id)
            .map((t) => ({ id: t.id, title: t.title, status: t.status })),
        })),
        gates: (gatesByMajor[maj.key] || []).map((g) => ({
          ...g,
          requires_milestones: gateLinks.filter((l) => l.gate_id === g.id).map((l) => l.milestone_id),
        })),
        updates: (updatesByMajor[maj.key] || []).map((u) => ({
          ...u,
          author: nameOf(users, u.created_by),
        })),
      }
    })
    .filter((w) => w.state || w.milestones.length || w.gates.length || w.updates.length)

  return {
    project: { ...project, assignee: nameOf(users, project.assignee_id) } as Row,
    stage: {
      stage: project.stage,
      deal_health: project.deal_health,
      deal_health_override: project.deal_health_override,
      on_hold_at: project.on_hold_at,
      archived_at: project.archived_at,
      risk: risk[0] || null,
      portfolio_priority: priority[0] || null,
    },
    financials: financials[0] || null,
    notes: notes.map((n) => ({ ...n, author: nameOf(users, n.user_id) })),
    threads: threads.map((t) => ({ ...t, author: t.user_name || nameOf(users, t.user_id) })),
    tasks: fatTasks,
    workstreams,
    stakeholders: stakeholders.map((s) => ({
      ...s,
      todos: stakeholderTodos.filter((t) => t.stakeholder_id === s.id),
    })),
    site: { buildings, meters, systems, permits, permit_attachments: permitAttachments },
    pricing: { versions: pricing, threads: pricingThreads },
    rfis: fatRfis,
    drawings: { drawings, reviews, findings, comments: reviewComments },
    dataroom_docs: dataroom,
    activity: activity.map((a) => ({ ...a, user: nameOf(users, a.user_id) })),
    reference: { departments, workstream_majors: majors },
    _viewer: { name: session.fullName, role: session.role },
    _counts: {
      notes: notes.length,
      threads: threads.length,
      tasks: tasks.length,
      task_messages: taskThreads.length,
      milestones: milestones.length,
      milestone_comments: msComments.length,
      workstream_updates: updates.length,
      rfis: rfis.length,
      rfi_responses: rfiResponses.length,
      stakeholders: stakeholders.length,
      buildings: buildings.length,
      meters: meters.length,
      systems: systems.length,
      permits: permits.length,
      drawings: drawings.length,
      findings: findings.length,
      activity: activity.length,
    },
  }
}

/**
 * Portfolio context, paged.
 *
 * The local server wrote multi-megabyte dumps to disk; over HTTP that is not an
 * option, so this returns a batch of fully-expanded projects plus a cursor.
 */
export async function portfolioContext(
  session: McpSession,
  {
    include_archived = false,
    include_activity = false,
    cursor = 0,
    batch_size = 4,
  }: {
    include_archived?: boolean
    include_activity?: boolean
    cursor?: number
    batch_size?: number
  } = {}
) {
  const filters: Filter[] = include_archived
    ? []
    : [{ column: 'archived_at', op: 'is', value: 'null' }]

  const all = await get(session, 'projects', {
    select: 'id,project_number,name',
    filters,
    limit: BIG,
    order: 'project_number.asc',
  })

  const size = Math.min(Math.max(1, batch_size), 8)
  const slice = all.slice(cursor, cursor + size)
  const projects = []
  for (const p of slice) projects.push(await projectContext(session, p.id, { include_activity }))

  const next = cursor + size
  return {
    generated_at: new Date().toISOString(),
    total_projects: all.length,
    returned: projects.length,
    cursor_used: cursor,
    next_cursor: next < all.length ? next : null,
    note:
      next < all.length
        ? `${all.length - next} projects remain — call again with cursor: ${next}.`
        : 'Final batch; every project has been returned.',
    projects,
  }
}
