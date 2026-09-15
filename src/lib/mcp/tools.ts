/**
 * Tool surface for the Pathwaze MCP server.
 *
 * Every handler takes the caller's session and reads through query.ts, so RLS
 * scopes the result to that user's Pathwaze role. Read-only throughout.
 */
import { get, describe, tableNames, resolveProject, userMap, nameOf, esc, BIG, type Filter } from './query'
import { projectContext, portfolioContext } from './context'
import type { McpSession } from './auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>

const projectRef = {
  type: 'string',
  description: 'Project number (e.g. "21460-FL-0011"), project id (uuid), or part of the project name.',
}

export const TOOLS = [
  {
    name: 'get_project_context',
    description:
      'THE MAIN TOOL. Returns the complete, unabridged record for one project: every note, every thread message (Slack + email), every task with its full message history, files, links and subtasks, every workstream with all milestones, milestone comments, exit gates and weekly updates, every stakeholder, all site assets (buildings, meters, systems, permits), pricing versions, all RFIs with every response, drawings with review findings, financials, risk score, stage and the activity log. Use this to build context on a project. Results are scoped to what your Pathwaze role can see.',
    inputSchema: {
      type: 'object',
      properties: {
        project: projectRef,
        include_activity: { type: 'boolean', description: 'Include the activity/audit log. Default true.' },
      },
      required: ['project'],
    },
  },
  {
    name: 'get_portfolio_context',
    description:
      'The same full expansion as get_project_context, across every project. Returns a batch plus a next_cursor — call repeatedly with the cursor until it comes back null to walk the whole portfolio.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'number', description: 'Start index. Omit for the first batch.' },
        batch_size: { type: 'number', description: 'Projects per batch, 1-8. Default 4.' },
        include_archived: { type: 'boolean' },
        include_activity: { type: 'boolean', description: 'Default false — large.' },
      },
    },
  },
  {
    name: 'list_projects',
    description: 'One-line summary of every project you can see: number, name, customer, stage, deal health, size, location, assignee, on-hold/archived flags.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Matches name, customer, city or project number.' },
        stage: { type: 'string' },
        state: { type: 'string', description: 'US state code, e.g. FL or IL.' },
        include_archived: { type: 'boolean' },
      },
    },
  },
  {
    name: 'search',
    description:
      'Full-text search across every free-text surface at once: project notes, thread messages (Slack + email), task titles/descriptions, task messages, workstream milestones and weekly updates, milestone comments, RFI subjects/questions/responses, stakeholders, permits and drawing review findings.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to look for.' },
        project: { ...projectRef, description: 'Optional: restrict to one project.' },
        limit_per_source: { type: 'number', description: 'Max hits per source table. Default 50.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_project_threads',
    description: 'Every thread message on a project in chronological order — Slack messages and mirrored Outlook email, with author, subject and addresses.',
    inputSchema: {
      type: 'object',
      properties: { project: projectRef, source: { type: 'string', description: '"slack" or "email".' } },
      required: ['project'],
    },
  },
  {
    name: 'get_project_notes',
    description: 'Every note on a project in chronological order, with author, type, category, event date and any attached file.',
    inputSchema: { type: 'object', properties: { project: projectRef }, required: ['project'] },
  },
  {
    name: 'list_tasks',
    description: 'Tasks across the portfolio or one project, with assignee, status, priority, due date, type and approval state. Set include_messages for the full discussion on each.',
    inputSchema: {
      type: 'object',
      properties: {
        project: projectRef,
        status: { type: 'string' },
        assignee: { type: 'string', description: 'Full name or email.' },
        overdue: { type: 'boolean', description: 'Only tasks past due and not complete.' },
        include_messages: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_workstreams',
    description: 'The workstream plan for a project: each major milestone with owner and state, all user milestones (target + baseline dates, weight, critical flag, status, risk, notes), milestone comments, linked tasks, exit gates and every weekly update.',
    inputSchema: { type: 'object', properties: { project: projectRef }, required: ['project'] },
  },
  {
    name: 'list_rfis',
    description: 'RFIs with ball-in-court, status, dates, cost/schedule impact and every response.',
    inputSchema: {
      type: 'object',
      properties: { project: projectRef, status: { type: 'string' }, open_only: { type: 'boolean' } },
    },
  },
  {
    name: 'list_stakeholders',
    description: 'The CRM directory: stakeholders with org, title, role, email, phone, sentiment and their open to-dos.',
    inputSchema: { type: 'object', properties: { project: projectRef, search: { type: 'string' } } },
  },
  {
    name: 'get_activity',
    description: 'The activity/audit feed — who changed what and when.',
    inputSchema: {
      type: 'object',
      properties: { project: projectRef, limit: { type: 'number', description: 'Default 200.' } },
    },
  },
  {
    name: 'list_tables',
    description:
      'Every table in the Pathwaze database, discovered live from the schema. This lists what EXISTS; what you can actually read from each is still decided by your role when you query it.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'describe_table',
    description: 'Columns, types and required flags for one table.',
    inputSchema: { type: 'object', properties: { table: { type: 'string' } }, required: ['table'] },
  },
  {
    name: 'query_table',
    description:
      'Read any table directly with filters, ordering and paging. Read-only. Filter operators are PostgREST: eq, neq, gt, gte, lt, lte, like, ilike, is, in, cs.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string' },
        select: { type: 'string', description: 'Columns, default "*".' },
        filters: {
          type: 'array',
          description: 'e.g. [{"column":"status","op":"eq","value":"open"}]',
          items: {
            type: 'object',
            properties: { column: { type: 'string' }, op: { type: 'string' }, value: {} },
            required: ['column', 'value'],
          },
        },
        order: { type: 'string', description: 'e.g. "created_at.desc"' },
        limit: { type: 'number' },
        offset: { type: 'number' },
      },
      required: ['table'],
    },
  },
  {
    name: 'list_users',
    description: 'Pathwaze users with roles, titles and status.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'whoami',
    description: 'The Pathwaze account this connection is authenticated as, and the role that scopes every other tool.',
    inputSchema: { type: 'object', properties: {} },
  },
]

// ---------------------------------------------------------------- handlers

const like = (s: string) => `*${esc(s)}*`

async function pidOf(s: McpSession, ref?: string): Promise<string | null> {
  return ref ? ((await resolveProject(s, ref, 'id,project_number,name')).id as string) : null
}

async function projectLabels(s: McpSession): Promise<Record<string, string>> {
  const rows = await get(s, 'projects', { select: 'id,project_number,name', limit: BIG })
  return Object.fromEntries(rows.map((p) => [p.id, `${p.project_number || '—'} ${p.name}`]))
}

type Handler = (s: McpSession, a: Args) => Promise<unknown>

export const handlers: Record<string, Handler> = {
  async get_project_context(s, { project, include_activity = true }) {
    return projectContext(s, project, { include_activity })
  },

  async get_portfolio_context(s, { cursor = 0, batch_size = 4, include_archived = false, include_activity = false }) {
    return portfolioContext(s, { cursor, batch_size, include_archived, include_activity })
  },

  async list_projects(s, { search, stage, state, include_archived = false }) {
    const filters: Filter[] = []
    if (!include_archived) filters.push({ column: 'archived_at', op: 'is', value: 'null' })
    if (stage) filters.push({ column: 'stage', value: esc(stage) })
    if (state) filters.push({ column: 'state', value: esc(state) })
    if (search) {
      filters.push({
        column: 'or',
        op: '',
        value: `(name.ilike.${like(search)},customer.ilike.${like(search)},city.ilike.${like(search)},project_number.ilike.${like(search)})`,
      })
    }
    const rows = await get(s, 'projects', {
      select:
        'id,project_number,name,customer,stage,deal_health,on_hold_at,archived_at,system_kwdc,system_kwac,city,state,utility,ahj,target_cod,start_date,region,tranche,assignee_id',
      filters,
      order: 'project_number.asc',
      limit: BIG,
    })
    const users = await userMap(s)
    return rows.map((p) => ({ ...p, assignee: nameOf(users, p.assignee_id) }))
  },

  async search(s, { query, project, limit_per_source = 50 }) {
    const pid = await pidOf(s, project)
    const pf: Filter[] = pid ? [{ column: 'project_id', value: pid }] : []
    const L = { limit: limit_per_source }

    const anyOf = (table: string, cols: string[]) =>
      get(s, table, {
        filters: [
          ...pf,
          { column: 'or', op: '', value: `(${cols.map((c) => `${c}.ilike.${like(query)}`).join(',')})` },
        ],
        ...L,
      }).catch(() => [] as Row[])

    const oneCol = (table: string, col: string) =>
      get(s, table, { filters: [{ column: col, op: 'ilike', value: like(query) }], ...L }).catch(
        () => [] as Row[]
      )

    const [notes, threads, tasks, taskMsgs, milestones, updates, msComments, rfis, rfiResp, stakeholders, permits, findings] =
      await Promise.all([
        anyOf('project_notes', ['title', 'body']),
        anyOf('project_threads', ['message', 'subject', 'from_addr']),
        anyOf('tasks', ['title', 'description']),
        oneCol('task_threads', 'message'),
        anyOf('workstream_milestones', ['label', 'description', 'notes']),
        anyOf('workstream_updates', ['body']),
        oneCol('workstream_milestone_comments', 'body'),
        anyOf('rfis', ['subject', 'question', 'location', 'drawing_number']),
        oneCol('rfi_responses', 'body'),
        anyOf('stakeholders', ['name', 'org', 'title', 'email', 'department']),
        anyOf('permits', ['name', 'notes', 'permit_number']),
        oneCol('review_findings', 'finding_text'),
      ])

    const labels = await projectLabels(s)
    // `_table` goes last: project_threads has its own `source` column and would
    // otherwise be confused with the tag.
    const tag = (rows: Row[], table: string) =>
      rows.map((r) => ({ ...r, _table: table, _project: r.project_id ? labels[r.project_id] : undefined }))

    const results = [
      ...tag(notes, 'project_notes'),
      ...tag(threads, 'project_threads'),
      ...tag(tasks, 'tasks'),
      ...tag(taskMsgs, 'task_threads'),
      ...tag(milestones, 'workstream_milestones'),
      ...tag(updates, 'workstream_updates'),
      ...tag(msComments, 'workstream_milestone_comments'),
      ...tag(rfis, 'rfis'),
      ...tag(rfiResp, 'rfi_responses'),
      ...tag(stakeholders, 'stakeholders'),
      ...tag(permits, 'permits'),
      ...tag(findings, 'review_findings'),
    ]
    return { query, total_hits: results.length, results }
  },

  async get_project_threads(s, { project, source }) {
    const pid = await pidOf(s, project)
    const filters: Filter[] = [{ column: 'project_id', value: pid }]
    if (source) filters.push({ column: 'source', value: esc(source) })
    const rows = await get(s, 'project_threads', { filters, order: 'created_at.asc', limit: BIG })
    const users = await userMap(s)
    return rows.map((t) => ({ ...t, author: t.user_name || nameOf(users, t.user_id) }))
  },

  async get_project_notes(s, { project }) {
    const pid = await pidOf(s, project)
    const rows = await get(s, 'project_notes', {
      filters: [{ column: 'project_id', value: pid }],
      order: 'created_at.asc',
      limit: BIG,
    })
    const users = await userMap(s)
    return rows.map((n) => ({ ...n, author: nameOf(users, n.user_id) }))
  },

  async list_tasks(s, { project, status, assignee, overdue, include_messages, limit = 500 }) {
    const filters: Filter[] = []
    const pid = await pidOf(s, project)
    if (pid) filters.push({ column: 'project_id', value: pid })
    if (status) filters.push({ column: 'status', value: esc(status) })

    const users = await userMap(s)
    if (assignee) {
      const hit = Object.values(users).find(
        (u) =>
          u.full_name?.toLowerCase() === String(assignee).toLowerCase() ||
          u.email?.toLowerCase() === String(assignee).toLowerCase()
      )
      if (!hit) throw new Error(`No user matches "${assignee}".`)
      filters.push({ column: 'assignee_id', value: hit.id })
    }

    let rows = await get(s, 'tasks', { filters, order: 'due_date.asc', limit })
    if (overdue) {
      const today = new Date().toISOString().slice(0, 10)
      rows = rows.filter(
        (t) => t.due_date && t.due_date < today && t.status !== 'complete' && t.status !== 'done'
      )
    }

    const labels = await projectLabels(s)
    const msgs: Record<string, Row[]> = {}
    if (include_messages && rows.length) {
      const all = await get(s, 'task_threads', {
        filters: [{ column: 'task_id', op: 'in', value: rows.map((r) => r.id) } as Filter],
        order: 'created_at.asc',
        limit: BIG,
      })
      for (const m of all) (msgs[m.task_id] ||= []).push({ ...m, author: nameOf(users, m.user_id) })
    }

    return rows.map((t) => ({
      ...t,
      project: labels[t.project_id],
      assignee: nameOf(users, t.assignee_id),
      ...(include_messages ? { messages: msgs[t.id] || [] } : {}),
    }))
  },

  async get_workstreams(s, { project }) {
    const data = await projectContext(s, project, { include_activity: false })
    return {
      project: `${data.project.project_number || ''} ${data.project.name}`.trim(),
      workstreams: data.workstreams,
    }
  },

  async list_rfis(s, { project, status, open_only }) {
    const filters: Filter[] = []
    const pid = await pidOf(s, project)
    if (pid) filters.push({ column: 'project_id', value: pid })
    if (status) filters.push({ column: 'status', value: esc(status) })
    if (open_only) filters.push({ column: 'closed_at', op: 'is', value: 'null' })

    const rows = await get(s, 'rfis', { filters, order: 'date_initiated.desc', limit: BIG })
    const responses = rows.length
      ? await get(s, 'rfi_responses', {
          filters: [{ column: 'rfi_id', op: 'in', value: rows.map((r) => r.id) } as Filter],
          order: 'created_at.asc',
          limit: BIG,
        })
      : []
    const users = await userMap(s)
    const labels = await projectLabels(s)
    return rows.map((r) => ({
      ...r,
      project: labels[r.project_id],
      ball_in_court: nameOf(users, r.ball_in_court_user_id),
      responses: responses.filter((x) => x.rfi_id === r.id),
    }))
  },

  async list_stakeholders(s, { project, search }) {
    const filters: Filter[] = []
    const pid = await pidOf(s, project)
    if (pid) filters.push({ column: 'project_id', value: pid })
    if (search) filters.push({ column: 'name', op: 'ilike', value: like(search) })

    const rows = await get(s, 'stakeholders', { filters, limit: BIG })
    const todos = rows.length
      ? await get(s, 'stakeholder_tasks', {
          filters: [{ column: 'stakeholder_id', op: 'in', value: rows.map((r) => r.id) } as Filter],
          limit: BIG,
        }).catch(() => [] as Row[])
      : []
    const labels = await projectLabels(s)
    return rows.map((x) => ({
      ...x,
      project: labels[x.project_id],
      todos: todos.filter((t) => t.stakeholder_id === x.id),
    }))
  },

  async get_activity(s, { project, limit = 200 }) {
    const filters: Filter[] = []
    if (project) {
      const pid = await pidOf(s, project)
      const tasks = await get(s, 'tasks', {
        select: 'id',
        filters: [{ column: 'project_id', value: pid }],
        limit: BIG,
      })
      const rfis = await get(s, 'rfis', {
        select: 'id',
        filters: [{ column: 'project_id', value: pid }],
        limit: BIG,
      })
      filters.push({
        column: 'entity_id',
        op: 'in',
        value: [pid, ...tasks.map((t) => t.id), ...rfis.map((r) => r.id)].slice(0, 300),
      } as Filter)
    }
    const rows = await get(s, 'activity_log', { filters, order: 'created_at.desc', limit })
    const users = await userMap(s)
    return rows.map((a) => ({ ...a, user: nameOf(users, a.user_id) }))
  },

  async list_tables() {
    return tableNames()
  },

  async describe_table(_s, { table }) {
    return describe(table)
  },

  async query_table(s, { table, select, filters, order, limit, offset }) {
    return get(s, table, { select, filters, order, limit, offset })
  },

  async list_users(s) {
    return Object.values(await userMap(s))
  },

  async whoami(s) {
    return {
      name: s.fullName,
      email: s.email,
      role: s.role,
      note: 'Every tool returns only what this Pathwaze role is permitted to see; the database enforces it.',
    }
  },
}
