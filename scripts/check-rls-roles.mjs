/**
 * Shows exactly what each Pathwaze role can read, straight through RLS.
 *
 *   node scripts/check-rls-roles.mjs
 *
 * Mints a short-lived Supabase JWT per role — the same way /api/mcp does — and
 * counts rows on the tables that matter. Run it BEFORE and AFTER migration 073
 * to see the change, and any time you want to confirm what a teammate would
 * actually see through the connector.
 *
 * Read-only. Requires SUPABASE_JWT_SECRET in .env.local
 * (Supabase dashboard -> Settings -> API -> JWT Secret).
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = env.SUPABASE_SERVICE_ROLE_KEY
const SECRET = env.SUPABASE_JWT_SECRET

if (!SECRET) {
  console.error(
    'SUPABASE_JWT_SECRET is not in .env.local.\n' +
      'Get it from Supabase -> Settings -> API -> JWT Secret, and use the SAME value in Vercel\n' +
      '(local dev and prod share one database, so a mismatch breaks tokens issued by the other).'
  )
  process.exit(1)
}

const b64 = (v) => Buffer.from(v).toString('base64url')

function mint(userId) {
  const now = Math.floor(Date.now() / 1000)
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64(JSON.stringify({
    sub: userId, role: 'authenticated', aud: 'authenticated',
    iss: 'supabase', iat: now, exp: now + 300,
  }))
  return `${h}.${p}.${b64(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())}`
}

/** Exact row count for one table as one user. */
async function countAs(jwt, table) {
  const r = await fetch(`${SB}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, Prefer: 'count=exact' },
    cache: 'no-store',
  })
  if (!r.ok) return `err ${r.status}`
  return Number((r.headers.get('content-range') || '').split('/')[1] ?? 0)
}

const TABLES = [
  'projects', 'project_notes', 'project_threads', 'tasks', 'task_threads',
  'workstream_milestones', 'workstream_updates', 'rfis', 'stakeholders',
  'permits', 'meters', 'project_financials',
]

const svcHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}` }
const users = await (
  await fetch(`${SB}/rest/v1/users?select=id,full_name,email,role,status&order=role`, {
    headers: svcHeaders,
    cache: 'no-store',
  })
).json()

// One representative active user per role.
const picks = []
for (const role of ['admin', 'manager', 'team', 'investor']) {
  const u = users.find((x) => x.role === role && (!x.status || x.status === 'active'))
  if (u) picks.push(u)
  else console.log(`(no active ${role} user on this database — skipping that column)`)
}

console.log(`\nRows visible per role, enforced by RLS\n${'='.repeat(76)}`)
const width = 26
process.stdout.write('table'.padEnd(width))
for (const u of picks) process.stdout.write(u.role.padEnd(12))
console.log('\n' + '-'.repeat(76))

for (const t of TABLES) {
  process.stdout.write(t.padEnd(width))
  for (const u of picks) {
    const n = await countAs(mint(u.id), t)
    process.stdout.write(String(n).padEnd(12))
  }
  console.log()
}

console.log('\nTested as:')
for (const u of picks) console.log(`  ${u.role.padEnd(9)} ${u.full_name || u.email}`)
console.log(
  '\nExpected after migration 073: admin and manager see everything; team sees\n' +
    'everything except project_financials (0); investor stays limited to granted projects.'
)
