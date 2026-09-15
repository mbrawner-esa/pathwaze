/**
 * Read-only PostgREST access for the MCP server, scoped to one user.
 *
 * Every request carries that user's short-lived Supabase JWT, so RLS decides
 * what comes back. There is no service-role path here — a bug in a tool can
 * return too little, never too much.
 *
 * Ported from the local stdio server's lib.mjs; the one material change is the
 * Authorization header.
 */
import type { McpSession } from './auth'

export const BIG = 100000

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Strip PostgREST filter metacharacters from user-supplied values. */
export const esc = (s: unknown) => String(s).replace(/[,()]/g, ' ')

export type Filter = { column: string; op?: string; value: unknown }

export type GetOptions = {
  select?: string
  filters?: (Filter | null | undefined)[]
  order?: string
  limit?: number | null
  offset?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

/**
 * GET one table as the session user. Table and column names are validated so a
 * tool argument cannot be used to reach a different path.
 */
export async function get(
  session: McpSession,
  table: string,
  { select = '*', filters = [], order, limit = 100, offset = 0 }: GetOptions = {}
): Promise<Row[]> {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) throw new Error(`Invalid table name: ${table}`)

  const qs = new URLSearchParams()
  qs.set('select', select)

  for (const f of filters) {
    if (!f) continue
    const { column, op = 'eq', value } = f
    if (!/^[a-z_][a-z0-9_.]*$/i.test(column)) throw new Error(`Invalid column: ${column}`)
    const v = Array.isArray(value) ? `(${value.join(',')})` : value
    // op === '' means the value is already a complete PostgREST expression,
    // which is how `or=(a.ilike.*x*,b.ilike.*x*)` has to be written.
    qs.append(column, op === '' ? String(v) : `${op}.${v}`)
  }

  if (order) qs.set('order', order)
  if (limit != null) qs.set('limit', String(Math.min(Number(limit) || 100, 2000)))
  if (offset) qs.set('offset', String(offset))

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    headers: {
      apikey: ANON_KEY,
      // The user's own JWT — this is what makes RLS the boundary.
      Authorization: `Bearer ${session.jwt}`,
    },
    cache: 'no-store',
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${table}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : []
}

/**
 * Live schema introspection.
 *
 * Supabase serves the OpenAPI document ONLY to the service_role key — a user
 * JWT gets 401 ("Only the `service_role` API key can be used for this"), so
 * this is the one call that cannot run as the caller.
 *
 * What comes back is schema *shape* — table and column names — not a single
 * row of project data. Every actual read still goes through get() on the
 * user's JWT, so knowing a table exists gets you nothing you couldn't already
 * read. The table names are in the repo and on the screen of anyone using the
 * app; the rows are what RLS protects.
 */
let specCache: Row | null = null
export async function openApiSpec(): Promise<Row> {
  if (specCache) return specCache

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error(
      'Schema introspection needs SUPABASE_SERVICE_ROLE_KEY (Supabase only serves the ' +
        'schema document to the service role). The data tools work without it.'
    )
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Schema introspection failed: ${res.status}`)
  specCache = (await res.json()) as Row
  return specCache
}

export async function tableNames(): Promise<string[]> {
  const spec = await openApiSpec()
  return Object.keys(spec.paths || {})
    .filter((p) => p !== '/' && !p.startsWith('/rpc/'))
    .map((p) => p.slice(1))
    .sort()
}

export async function describe(table: string) {
  const spec = await openApiSpec()
  const def = spec.definitions?.[table]
  if (!def) throw new Error(`Unknown table: ${table}`)
  return {
    table,
    columns: Object.entries(def.properties || {}).map(([name, p]) => ({
      name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (p as any).format || (p as any).type,
      required: (def.required || []).includes(name),
    })),
  }
}

/** Resolve "21460-FL-0011", a uuid, or part of a name to a project row. */
export async function resolveProject(session: McpSession, ref: string, select = '*'): Promise<Row> {
  if (!ref) throw new Error('A project reference is required')
  const r = String(ref).trim()

  if (UUID_RE.test(r)) {
    const [p] = await get(session, 'projects', {
      select,
      filters: [{ column: 'id', value: r }],
      limit: 1,
    })
    if (p) return p
  }

  let rows = await get(session, 'projects', {
    select,
    filters: [{ column: 'project_number', value: esc(r) }],
    limit: 2,
  })
  if (rows.length === 1) return rows[0]

  rows = await get(session, 'projects', {
    select,
    filters: [{ column: 'name', op: 'ilike', value: `*${esc(r)}*` }],
    limit: 5,
  })
  if (rows.length === 1) return rows[0]
  if (rows.length > 1) {
    throw new Error(
      `"${ref}" matches ${rows.length} projects: ` +
        rows.map((p) => `${p.project_number || '—'} ${p.name}`).join(' | ') +
        '. Use the project_number or id.'
    )
  }
  throw new Error(
    `No project matches "${ref}". (If you expected one, it may be outside what your Pathwaze role can see.)`
  )
}

/**
 * id -> user, for humanising the *_by / *_id columns.
 *
 * Notification-preference and Slack columns are deliberately excluded — tools
 * only ever need to turn an id into a name.
 */
export async function userMap(session: McpSession): Promise<Record<string, Row>> {
  const rows = await get(session, 'users', {
    select: 'id,full_name,email,role,title,status',
    limit: 500,
  })
  return Object.fromEntries(rows.map((u) => [u.id, u]))
}

export const nameOf = (users: Record<string, Row>, id: string | null | undefined): string | null =>
  id ? users[id]?.full_name || users[id]?.email || id : null
