/**
 * Verifies migration 076 — recoverable delete for notes and RFIs.
 *
 *   node scripts/verify-soft-delete.mjs
 *
 * Mints a real Supabase JWT per role (the same way /api/mcp does) and drives
 * PostgREST directly, so every assertion goes through live RLS and the live
 * trigger rather than through application code that could be bypassed.
 *
 * Creates two throwaway records and removes them at the end, hard, via the
 * service role. Requires SUPABASE_JWT_SECRET in .env.local.
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
if (!SECRET) { console.error('SUPABASE_JWT_SECRET missing from .env.local'); process.exit(1) }

let failures = 0
const ok = (what, detail = '') => console.log(`  PASS  ${what}${detail ? ' — ' + detail : ''}`)
const bad = (what, detail = '') => { failures++; console.log(`  FAIL  ${what}${detail ? ' — ' + detail : ''}`) }

const b64 = (v) => Buffer.from(v).toString('base64url')
function mint(userId) {
  const now = Math.floor(Date.now() / 1000)
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64(JSON.stringify({
    sub: userId, role: 'authenticated', aud: 'authenticated',
    iss: 'supabase', iat: now, exp: now + 600,
  }))
  const sig = b64(crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest())
  return `${h}.${p}.${sig}`
}

const svcH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'content-type': 'application/json' }
const asSvc = async (p, init) => fetch(`${SB}/rest/v1/${p}`, { ...init, headers: { ...svcH, ...(init?.headers || {}) }, cache: 'no-store' })
const userH = (jwt) => ({ apikey: ANON, Authorization: `Bearer ${jwt}`, 'content-type': 'application/json' })
const asUser = async (jwt, p, init) => fetch(`${SB}/rest/v1/${p}`, { ...init, headers: { ...userH(jwt), ...(init?.headers || {}) }, cache: 'no-store' })

// ------------------------------------------------------------------ fixtures
const users = await (await asSvc('users?select=id,full_name,role,status&status=eq.active')).json()
const admin = users.find((u) => u.role === 'admin')
const team = users.find((u) => u.role === 'team')
const manager = users.find((u) => u.role === 'manager')
if (!admin || !team) { console.error('need an active admin and an active team user'); process.exit(1) }
const [project] = await (await asSvc('projects?select=id,name&limit=1')).json()

const adminJwt = mint(admin.id)
const teamJwt = mint(team.id)

console.log(`\nVerifying 076 as admin=${admin.full_name}, team=${team.full_name}`)
if (!manager) console.log('(no active manager on this database — the manager path is untested)')

const stamp = Date.now()
const [note] = await (await asSvc('project_notes', {
  method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ project_id: project.id, type: 'note', title: `soft-delete check ${stamp}`, body: '<p>temporary</p>', user_id: admin.id }),
})).json()
const nextNum = await (await asSvc(`rpc/next_rfi_number?p_project=${project.id}`, { method: 'POST', body: JSON.stringify({ p_project: project.id }) })).json()
const [rfi] = await (await asSvc('rfis', {
  method: 'POST', headers: { Prefer: 'return=representation' },
  body: JSON.stringify({ project_id: project.id, rfi_number: typeof nextNum === 'number' ? nextNum : 9000, subject: `soft-delete check ${stamp}`, status: 'draft', created_by: admin.id }),
})).json()

const cleanup = async () => {
  await asSvc(`project_notes?id=eq.${note.id}`, { method: 'DELETE' })
  await asSvc(`rfis?id=eq.${rfi.id}`, { method: 'DELETE' })
}

try {
  // ---------------------------------------------------------- 1. the columns
  console.log('\n1. Schema')
  const cols = await (await asSvc(`project_notes?select=deleted_at,deleted_by&id=eq.${note.id}`)).json()
  Array.isArray(cols) && 'deleted_at' in (cols[0] ?? {})
    ? ok('deleted_at / deleted_by present on project_notes')
    : bad('columns missing', JSON.stringify(cols).slice(0, 120))

  // ------------------------------------------- 2. team keeps its real powers
  console.log('\n2. Team capabilities are unchanged by dropping the FOR ALL policy')
  const tIns = await asUser(teamJwt, 'project_notes', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ project_id: project.id, type: 'note', title: `team insert ${stamp}`, body: '<p>x</p>', user_id: team.id }),
  })
  const teamNote = tIns.ok ? (await tIns.json())[0] : null
  teamNote ? ok('team can still create a note') : bad('team lost INSERT on notes', `${tIns.status} ${(await tIns.text()).slice(0, 120)}`)

  if (teamNote) {
    const tUpd = await asUser(teamJwt, `project_notes?id=eq.${teamNote.id}`, {
      method: 'PATCH', body: JSON.stringify({ title: `team update ${stamp}` }),
    })
    tUpd.ok ? ok('team can still edit a note') : bad('team lost UPDATE on notes', String(tUpd.status))
    await asSvc(`project_notes?id=eq.${teamNote.id}`, { method: 'DELETE' })
  }

  // -------------------------------------------- 3. team cannot delete at all
  console.log('\n3. Team cannot delete')
  const tHard = await asUser(teamJwt, `project_notes?id=eq.${note.id}`, { method: 'DELETE' })
  const stillThere = (await (await asSvc(`project_notes?select=id&id=eq.${note.id}`)).json()).length === 1
  stillThere ? ok('team hard DELETE removes nothing', `status ${tHard.status}`) : bad('TEAM HARD-DELETED A NOTE', 'policy 020 still live?')

  const tSoft = await asUser(teamJwt, `project_notes?id=eq.${note.id}`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  })
  const tSoftBody = await tSoft.text()
  !tSoft.ok && /admin or manager/i.test(tSoftBody)
    ? ok('team soft delete refused by the trigger')
    : bad('team was able to soft delete', `${tSoft.status} ${tSoftBody.slice(0, 140)}`)

  // ------------------------------------------------------- 4. admin deletes
  console.log('\n4. Admin deletes, and it disappears for team')
  const aDel = await asUser(adminJwt, `project_notes?id=eq.${note.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  })
  aDel.ok ? ok('admin can soft delete a note') : bad('admin soft delete failed', `${aDel.status} ${(await aDel.text()).slice(0, 140)}`)

  const [row] = await (await asSvc(`project_notes?select=deleted_at,deleted_by&id=eq.${note.id}`)).json()
  row?.deleted_by === admin.id
    ? ok('deleted_by stamped by the trigger', admin.full_name)
    : bad('deleted_by not set to the caller', JSON.stringify(row))

  const teamSees = await (await asUser(teamJwt, `project_notes?select=id&id=eq.${note.id}`)).json()
  teamSees.length === 0 ? ok('team no longer sees the deleted note') : bad('DELETED NOTE VISIBLE TO TEAM', JSON.stringify(teamSees))

  const adminSees = await (await asUser(adminJwt, `project_notes?select=id&id=eq.${note.id}`)).json()
  adminSees.length === 1 ? ok('admin still sees it, so it can be restored') : bad('admin cannot see the deleted note', JSON.stringify(adminSees))

  // --------------------------------------------------------- 5. restore
  console.log('\n5. Restore')
  const aRes = await asUser(adminJwt, `project_notes?id=eq.${note.id}`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: null }),
  })
  const [after] = await (await asSvc(`project_notes?select=deleted_at,deleted_by&id=eq.${note.id}`)).json()
  aRes.ok && after?.deleted_at === null && after?.deleted_by === null
    ? ok('admin restored it, deleted_by cleared')
    : bad('restore failed', JSON.stringify(after))

  const teamSeesAgain = await (await asUser(teamJwt, `project_notes?select=id&id=eq.${note.id}`)).json()
  teamSeesAgain.length === 1 ? ok('team sees the restored note again') : bad('restored note still hidden from team')

  // --------------------------------------------------------- 6. RFIs
  console.log('\n6. RFIs behave the same')
  const rTeam = await asUser(teamJwt, `rfis?id=eq.${rfi.id}`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  })
  const rTeamBody = await rTeam.text()
  !rTeam.ok ? ok('team cannot delete an RFI', `${rTeam.status}`) : bad('team deleted an RFI', rTeamBody.slice(0, 140))

  const rAdmin = await asUser(adminJwt, `rfis?id=eq.${rfi.id}`, {
    method: 'PATCH', body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  })
  rAdmin.ok ? ok('admin can delete an RFI') : bad('admin RFI delete failed', `${rAdmin.status} ${(await rAdmin.text()).slice(0, 140)}`)

  const rTeamSees = await (await asUser(teamJwt, `rfis?select=id&id=eq.${rfi.id}`)).json()
  rTeamSees.length === 0 ? ok('team no longer sees the deleted RFI') : bad('DELETED RFI VISIBLE TO TEAM')

  const [numRow] = await (await asSvc(`rfis?select=rfi_number&id=eq.${rfi.id}`)).json()
  numRow?.rfi_number === rfi.rfi_number ? ok('RFI keeps its number while deleted', `#${numRow.rfi_number}`) : bad('RFI number changed')
} finally {
  await cleanup()
  console.log('\n(test records removed)')
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
