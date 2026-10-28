/**
 * End-to-end check for the Pathwaze MCP server.
 *
 * Run AFTER migrations 073 and 074 are applied:
 *   node scripts/verify-mcp.mjs                          # against localhost:3000
 *   node scripts/verify-mcp.mjs https://pathwaze.esa-solar.com
 *
 * It drives the whole OAuth flow except the browser consent screen, which it
 * simulates by writing the authorization code directly with the service role —
 * everything downstream of that (PKCE exchange, token issue, MCP calls, RLS
 * scoping, revocation) is exercised for real.
 *
 * Read-only apart from the OAuth bookkeeping rows it creates and cleans up.
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '')

const env = {}
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '')
const SVC = env.SUPABASE_SERVICE_ROLE_KEY
const svcHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'content-type': 'application/json' }

let failures = 0
const NL = String.fromCharCode(10)
const ok = (label, detail = '') => console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
const bad = (label, detail = '') => { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
const head = (t) => console.log(`\n${t}\n${'-'.repeat(t.length)}`)

const sbGet = async (pathname) => {
  const r = await fetch(`${SB}/rest/v1/${pathname}`, { headers: svcHeaders, cache: 'no-store' })
  return r.ok ? r.json() : null
}

// ---------------------------------------------------------------- 1. schema
head('1. Migrations')

for (const t of ['mcp_clients', 'mcp_auth_codes', 'mcp_tokens']) {
  const r = await fetch(`${SB}/rest/v1/${t}?select=*&limit=1`, { headers: svcHeaders })
  r.ok ? ok(`${t} exists`) : bad(`${t} missing`, 'run migration 074')
}

// 073: every internal role should now have a read policy on projects.
const policyProbe = await sbGet('projects?select=id&limit=1')
policyProbe ? ok('projects readable with service role') : bad('projects not readable')

// ------------------------------------------------------------- 2. discovery
head('2. OAuth discovery')

const prm = await (await fetch(`${BASE}/.well-known/oauth-protected-resource`)).json()
prm.resource?.endsWith('/api/mcp')
  ? ok('protected-resource metadata', prm.resource)
  : bad('protected-resource metadata', JSON.stringify(prm))

const asm = await (await fetch(`${BASE}/.well-known/oauth-authorization-server`)).json()
asm.code_challenge_methods_supported?.includes('S256')
  ? ok('authorization-server metadata', `issuer ${asm.issuer}`)
  : bad('authorization-server metadata', JSON.stringify(asm))

const unauth = await fetch(`${BASE}/api/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
})
unauth.status === 401 && unauth.headers.get('www-authenticate')
  ? ok('unauthenticated call returns 401 + WWW-Authenticate')
  : bad('unauthenticated call', `status ${unauth.status}`)

// ------------------------------------------------------- 3. register + PKCE
head('3. Registration and token exchange')

const redirectUri = 'http://localhost:8765/callback'
const reg = await (await fetch(`${BASE}/api/mcp/oauth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ client_name: 'verify-mcp script', redirect_uris: [redirectUri] }),
})).json()

reg.client_id ? ok('dynamic client registration', reg.client_id) : bad('registration', JSON.stringify(reg))

const verifier = crypto.randomBytes(32).toString('base64url')
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

// Pick the admin to test as — the browser consent step is what normally binds
// a user, so stand in for it here.
const [admin] = (await sbGet('users?select=id,full_name,role&role=eq.admin&limit=1')) || []
if (!admin) bad('no admin user found to test as')

const code = crypto.randomBytes(24).toString('base64url')
const insert = await fetch(`${SB}/rest/v1/mcp_auth_codes`, {
  method: 'POST',
  headers: svcHeaders,
  body: JSON.stringify({
    code,
    client_id: reg.client_id,
    user_id: admin.id,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'pathwaze:read pathwaze:write',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  }),
})
insert.ok ? ok('authorization code stored (stands in for consent)') : bad('could not store code', await insert.text())

// Wrong verifier must be rejected.
const badEx = await (await fetch(`${BASE}/api/mcp/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ grant_type: 'authorization_code', code, code_verifier: 'wrong-verifier', redirect_uri: redirectUri }),
})).json()
badEx.error === 'invalid_grant' ? ok('PKCE rejects a bad verifier') : bad('PKCE check', JSON.stringify(badEx))

// That attempt burned the code, so write a fresh one for the real exchange.
const code2 = crypto.randomBytes(24).toString('base64url')
await fetch(`${SB}/rest/v1/mcp_auth_codes`, {
  method: 'POST',
  headers: svcHeaders,
  body: JSON.stringify({
    code: code2,
    client_id: reg.client_id,
    user_id: admin.id,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'pathwaze:read pathwaze:write',
    expires_at: new Date(Date.now() + 300000).toISOString(),
  }),
})

const tok = await (await fetch(`${BASE}/api/mcp/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ grant_type: 'authorization_code', code: code2, code_verifier: verifier, redirect_uri: redirectUri }),
})).json()

const token = tok.access_token
token ? ok('token exchange', `expires in ${Math.round(tok.expires_in / 86400)}d`) : bad('token exchange', JSON.stringify(tok))

// Replay of a spent code must fail.
const replay = await (await fetch(`${BASE}/api/mcp/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ grant_type: 'authorization_code', code: code2, code_verifier: verifier, redirect_uri: redirectUri }),
})).json()
replay.error === 'invalid_grant' ? ok('authorization code is single-use') : bad('code replay was accepted')

// ------------------------------------------------------------- 4. MCP calls
head('4. MCP tools')

let rpcId = 0
const rpc = async (method, params) => {
  const r = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  return r.json()
}
const callTool = async (name, args = {}) => {
  const res = await rpc('tools/call', { name, arguments: args })
  const text = res.result?.content?.[0]?.text ?? ''
  if (res.result?.isError) throw new Error(`${name}: ${text}`)
  try { return JSON.parse(text) } catch { return text }
}

const init = await rpc('initialize', {})
init.result?.serverInfo?.name === 'pathwaze'
  ? ok('initialize', init.result.protocolVersion)
  : bad('initialize', JSON.stringify(init))

const list = await rpc('tools/list', {})
list.result?.tools?.length
  ? ok('tools/list', `${list.result.tools.length} tools`)
  : bad('tools/list', JSON.stringify(list))

try {
  const me = await callTool('whoami')
  me.role === admin.role ? ok('whoami', `${me.name} (${me.role})`) : bad('whoami', JSON.stringify(me))

  const projects = await callTool('list_projects')
  Array.isArray(projects) && projects.length
    ? ok('list_projects', `${projects.length} projects`)
    : bad('list_projects', 'no projects returned — check migration 073')

  const hits = await callTool('search', { query: 'interconnection', limit_per_source: 10 })
  hits.total_hits > 0
    ? ok('search', `${hits.total_hits} hits across ${new Set(hits.results.map(r => r._table)).size} tables`)
    : bad('search', 'no hits')

  const target = projects[0].project_number || projects[0].id
  const ctx = await callTool('get_project_context', { project: target })
  const c = ctx._counts
  c
    ? ok('get_project_context', `${target}: ${c.milestones} milestones, ${c.tasks} tasks, ${c.threads} messages, ${c.rfis} RFIs`)
    : bad('get_project_context', JSON.stringify(ctx).slice(0, 200))

  const page = await callTool('get_portfolio_context', { batch_size: 2 })
  page.projects?.length === 2 && page.total_projects
    ? ok('get_portfolio_context paging', `${page.returned}/${page.total_projects}, next_cursor ${page.next_cursor}`)
    : bad('get_portfolio_context', JSON.stringify(page).slice(0, 200))

  const tables = await callTool('list_tables')
  tables.length ? ok('list_tables', `${tables.length} tables`) : bad('list_tables')

  const rfis = await callTool('list_rfis')
  ok('list_rfis', `${rfis.length} RFIs, ${rfis.reduce((n, r) => n + r.responses.length, 0)} responses`)

  const stake = await callTool('list_stakeholders')
  ok('list_stakeholders', `${stake.length} stakeholders`)

  // A bad argument should come back as a readable tool error, not a crash.
  try {
    await callTool('get_project_context', { project: 'definitely-not-a-project' })
    bad('unknown project should error')
  } catch (e) {
    ok('unknown project errors cleanly', e.message.slice(0, 60))
  }
} catch (e) {
  bad('tool call threw', e.message)
}

// --------------------------------------------------------------- 5. writes
head('5. Write tools')

const createdIds = { project_notes: [], tasks: [], rfis: [] }

try {
  const projects = await callTool('list_projects')
  const target = projects[0].project_number || projects[0].id
  const me = await callTool('whoami')
  const stamp = Date.now()

  if (!me.can_write) {
    bad('token has no write scope', 'reconnect the connector to grant it')
    throw new Error('skipping write checks')
  }

  // --- note, with the full formatting surface ---
  const md = [
    '## Verification note',
    '',
    'Created by scripts/verify-mcp.mjs. Safe to delete.',
    '',
    '- Bulleted **bold** item',
    '- Item with *emphasis* and [a link](https://example.com)',
    '',
    '1. First numbered',
    '2. Second numbered',
  ].join(NL)

  const note = await callTool('create_note', {
    project: target, title: `Verification ${stamp}`, body: md, idempotency_key: `verify-note-${stamp}`,
  })
  createdIds.project_notes.push(note.id)
  ok('create_note', `${note.id} on ${note.project}`)

  // Formatting fidelity — the acceptance test for this feature.
  const [noteRow] = await sbGet(`project_notes?select=body,created_via&id=eq.${note.id}`)
  const html = noteRow?.body ?? ''
  const checks = [
    ['<ul>', 'bulleted list'], ['<ol>', 'numbered list'], ['<b>', 'bold'],
    ['<i>', 'italic'], ['<a href="https://example.com', 'link'], ['<p>', 'paragraph'],
  ]
  const missing = checks.filter(([frag]) => !html.includes(frag)).map(([, name]) => name)
  missing.length ? bad('note formatting', `missing: ${missing.join(', ')}`)
                 : ok('note formatting', 'bullets, numbers, bold, italic, link, paragraphs')
  noteRow?.created_via === 'mcp' ? ok('created_via stamped') : bad('created_via', String(noteRow?.created_via))
  const rawTag = new RegExp('<(script|img|iframe)', 'i')
  if (rawTag.test(html)) bad('unexpected raw tag in stored HTML')
  else ok('no unexpected tags in stored HTML')

  // --- idempotency ---
  const replay = await callTool('create_note', {
    project: target, title: `Verification ${stamp}`, body: md, idempotency_key: `verify-note-${stamp}`,
  })
  replay.replayed ? ok('idempotency key replays', 'original returned, no duplicate')
                  : bad('idempotency', 'a second note was created')

  // --- HTML input is refused ---
  try {
    await callTool('create_note', { project: target, body: '<script>alert(1)</script><b>hi</b>' })
    bad('HTML input should be refused')
  } catch (e) {
    /markdown/i.test(e.message) ? ok('HTML input refused with guidance') : bad('HTML refusal message', e.message)
  }

  // --- task with a due date and an assignee ---
  const due = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const task = await callTool('create_task', {
    project: target, title: `Verification task ${stamp}`,
    description: `Created by the verification script.${NL}${NL}- One${NL}- Two`,
    assignee: me.email, due_date: due, type: 'Engineering', priority: 'Low',
    idempotency_key: `verify-task-${stamp}`,
  })
  createdIds.tasks.push(task.id)
  task.due_date === due && task.status === 'Draft'
    ? ok('create_task', `${task.id} due ${task.due_date}, status ${task.status}`)
    : bad('create_task', JSON.stringify(task))

  try {
    await callTool('create_task', { project: target, title: 'bad date', due_date: 'next Friday' })
    bad('loose date should be refused')
  } catch (e) {
    /YYYY-MM-DD/.test(e.message) ? ok('loose date refused') : bad('date refusal', e.message)
  }

  // --- RFI assigned to an internal user ---
  const rfi = await callTool('create_rfi', {
    project: target, subject: `Verification RFI ${stamp}`,
    question: `Created by the **verification** script. Safe to close.${NL}${NL}- Point one${NL}- Point two`,
    assignee: me.email, idempotency_key: `verify-rfi-${stamp}`,
  })
  createdIds.rfis.push(rfi.id)
  ok('create_rfi', `#${rfi.rfi_number} ${rfi.status}, ball-in-court ${rfi.ball_in_court}`)

  // The RFI question is rendered with whitespace-pre-wrap, not as HTML — so
  // tags stored here would be visible on the page.
  const [rfiRow] = await sbGet(`rfis?select=question&id=eq.${rfi.id}`)
  const q = rfiRow?.question ?? ''
  const hasMarkup = new RegExp('<[a-zA-Z]').test(q)
  if (hasMarkup) bad('RFI question contains markup', q.slice(0, 120))
  else ok('RFI question is plain text', 'no tags stored')

  const readsCleanly = q.includes('• Point one') && q.includes('verification script') && !q.includes('**')
  if (readsCleanly) ok('RFI question reads cleanly', 'bullets kept, markdown markers stripped')
  else bad('RFI question formatting', JSON.stringify(q.slice(0, 160)))

  // --- containment: the database must refuse an external recipient ---
  const [sh] = await sbGet('stakeholders?select=id&limit=1')
  if (sh) {
    const r = await fetch(`${SB}/rest/v1/rfis?id=eq.${rfi.id}`, {
      method: 'PATCH', headers: { ...svcHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ ball_in_court_stakeholder_id: sh.id }),
    })
    const body = await r.text()
    !r.ok && /rfis_mcp_no_external_recipients/.test(body)
      ? ok('containment holds', 'database refused an external ball-in-court on an MCP RFI')
      : bad('CONTAINMENT BREACH', `expected rejection, got ${r.status} ${body.slice(0, 160)}`)
  }

  const dist = await sbGet(`rfi_distribution?select=id&rfi_id=eq.${rfi.id}`)
  dist?.length === 0 ? ok('no distribution rows on MCP RFI') : bad('distribution rows exist', JSON.stringify(dist))
} catch (e) {
  if (!/skipping write checks/.test(e.message)) bad('write tool threw', e.message)
}

// Clean up everything the write checks created.
for (const [table, ids] of Object.entries(createdIds)) {
  for (const id of ids) {
    await fetch(`${SB}/rest/v1/${table}?id=eq.${id}`, { method: 'DELETE', headers: svcHeaders })
  }
}
await fetch(`${SB}/rest/v1/mcp_idempotency?key=like.verify-*`, { method: 'DELETE', headers: svcHeaders })
console.log('  (verification records deleted)')

// ------------------------------------------------------------ 6. revocation
head('6. Revocation')

await fetch(`${BASE}/api/mcp/oauth/revoke`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token }),
})
const after = await fetch(`${BASE}/api/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list' }),
})
after.status === 401 ? ok('revoked token is rejected') : bad('revoked token still works', `status ${after.status}`)

// ---------------------------------------------------------------- clean up
await fetch(`${SB}/rest/v1/mcp_tokens?client_id=eq.${reg.client_id}`, { method: 'DELETE', headers: svcHeaders })
await fetch(`${SB}/rest/v1/mcp_clients?client_id=eq.${reg.client_id}`, { method: 'DELETE', headers: svcHeaders })
console.log('\n(test client and tokens cleaned up)')

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
