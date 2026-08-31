// Sample data — one clearly-labelled test project for exercising /health.
//
//   node scripts/seed-test-project.mjs          create / refresh it
//   node scripts/seed-test-project.mjs --drop   remove it completely
//
// ⚠️  Local dev and production share the same Supabase database (CLAUDE.md), so
//     this writes to the DB the team uses. It is built to be safe on that basis:
//
//       · It touches ONE project, identified by project_number 'TEST-0001'.
//         No existing project is read, updated or deleted.
//       · It is idempotent — re-running rebuilds only this project's milestones,
//         so you always land on the same known state.
//       · --drop removes it and everything hanging off it.
//
//     The name leads with "ZZ TEST" so it sorts last in every list and is
//     unmistakable in a screen share.
//
// Dates are RELATIVE to the day you run it, so the sample keeps exercising all
// three horizons — This Week, Near Term, Long Term — however long from now it
// runs. A milestone whose baseline is earlier than its target reads as slipped,
// which is what drives red variance and the delayed light.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const PROJECT_NUMBER = 'TEST-0001'
const PROJECT_NAME = 'ZZ TEST — Sample Hospital'

// ── env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const out = {}
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    throw new Error('Could not read .env.local — run this from the repo root.')
  }
  return out
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')

// Service role: this runs outside a user session and must bypass RLS.
const db = createClient(url, key, { auth: { persistSession: false } })

// ── dates ─────────────────────────────────────────────────────────────
/** Offset from today as a YYYY-MM-DD calendar day (never an instant). */
function day(offset) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// major_key, label, target offset, baseline offset, status, weight, critical, order
const PLAN = [
  // ── Commercial ──
  ['term_sheet',             'Term sheet issued',                 -45, -45, 'complete',     50, false, 1],
  ['term_sheet',             'Term sheet countersigned',            5,   5, 'in_progress',  50, true,  2],
  ['savings_validation',     'Utility bill analysis',             -20, -20, 'complete',     40, false, 1],
  ['savings_validation',     'Savings model validated',            25,  25, 'not_started',  60, false, 2],
  ['legal_review',           'Redlines returned from counsel',     40,  40, 'not_started', 100, false, 1],
  ['closing',                'Final signature package',            75,  75, 'not_started', 100, true,  1],

  // ── Technical ──
  ['site_feasibility',       'Site survey',                       -30, -30, 'complete',     50, false, 1],
  // slipped 12 days and now blocked — should sort to the top of the board
  ['site_feasibility',       'Structural report',                   2, -10, 'blocked',      50, true,  2],
  ['design_development',     '30% design set',                     14,  14, 'in_progress',  40, false, 1],
  // overdue AND slipped: target already passed and moved off its baseline
  ['design_development',     'Electrical room remediation scope',  -3, -17, 'blocked',      60, true,  2],
  ['late_stage_development', '60% design set',                     60,  60, 'not_started', 100, false, 1],
  ['pre_construction',       'Issued-for-construction set',       120, 120, 'not_started', 100, true,  1],
  ['construction',           'Mobilization',                      180, 180, 'not_started', 100, false, 1],

  // ── Approvals ──
  ['governing_requirements', 'Code review complete',                6,   6, 'in_progress', 100, false, 1],
  ['utility_approval',       'Interconnection application filed', -15, -15, 'complete',     40, false, 1],
  ['utility_approval',       'System impact study results',         4,  -8, 'blocked',      60, true,  2],
  ['ahca_approval',          'AHCA submittal',                     35,  35, 'not_started', 100, false, 1],
  ['discretionary_permits',  'Zoning approval',                    90,  90, 'not_started', 100, false, 1],
  ['ministerial_permits',    'Building permit issued',            150, 150, 'not_started', 100, false, 1],
  ['notice_to_proceed',      'NTP executed',                      200, 200, 'not_started', 100, true,  1],
]

// Weekly notes give the complexity scorer something real to read, and populate
// the expanded card. Written as the PM would write them.
const NOTES = [
  ['technical', 'design_development',
   '<p>Survey came back and the existing electrical room cannot take the new gear — the transformer pad is undersized and there is no clearance for the new switchgear. Structural walkthrough booked; scope and cost unknown until then. This is now the critical item.</p>'],
  ['approvals', 'utility_approval',
   '<p>Duke has come back requiring a full system impact study rather than the fast-track review we scoped for. Adds roughly six weeks. Need a decision on whether we resize below the threshold to avoid it, which would cost about 180 kW of capacity.</p>'],
  ['commercial', 'term_sheet',
   '<p>Legal cleared the last redline on the term sheet. Countersignature expected this week. No open commercial issues.</p>'],
  ['technical', 'site_feasibility',
   '<p>Structural engineer flagged possible roof deck corrosion in the north bay during the walkthrough. Waiting on core samples before we can confirm whether the array layout holds.</p>'],
]

async function drop() {
  const { data: p } = await db.from('projects').select('id').eq('project_number', PROJECT_NUMBER).maybeSingle()
  if (!p) { console.log(`No ${PROJECT_NUMBER} project found — nothing to remove.`); return }

  // portfolio_priority and project_complexity cascade on project delete, but
  // they may not exist yet if 069/070 have not been run — so ignore their
  // errors rather than failing the teardown.
  for (const t of ['portfolio_priority', 'project_complexity']) {
    await db.from(t).delete().eq('project_id', p.id).then(() => {}, () => {})
  }
  await db.from('workstream_updates').delete().eq('project_id', p.id)
  await db.from('workstream_milestones').delete().eq('project_id', p.id)
  await db.from('workstream_major_state').delete().eq('project_id', p.id)
  await db.from('projects').delete().eq('id', p.id)
  console.log(`Removed ${PROJECT_NAME} (${p.id}).`)
}

async function seed() {
  // ── the project ──
  const { data: project, error: pErr } = await db.from('projects').upsert({
    project_number: PROJECT_NUMBER,
    name: PROJECT_NAME,
    customer: 'AdventHealth',
    stage: 'Design Development',
    deal_health: 'At Risk',
    system_kwdc: 2400,
    system_kwac: 1900,
    address: '1 Sample Way',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
    utility: 'Duke Energy',
    tranche: 'Tranche 1',
    // A project left On Hold by an earlier run would be invisible on the board,
    // which looks like the seed failed. Always bring it back active.
    on_hold_at: null,
  }, { onConflict: 'project_number' }).select('id').single()
  if (pErr) throw pErr
  const pid = project.id

  // Project manager + major owners. Any admin will do; the board only shows the
  // name. Falls back to whoever exists if there is no admin.
  const { data: admin } = await db.from('users').select('id')
    .eq('role', 'admin').limit(1).maybeSingle()
  const { data: anyone } = await db.from('users').select('id').limit(1).maybeSingle()
  const owner = admin?.id ?? anyone?.id ?? null
  if (owner) await db.from('projects').update({ assignee_id: owner }).eq('id', pid)

  // ── rebuild this project's plan ──
  await db.from('workstream_updates').delete().eq('project_id', pid)
  await db.from('workstream_milestones').delete().eq('project_id', pid)

  // Only majors that actually exist in the catalog: a renamed or retired key
  // contributes nothing rather than failing the run.
  const { data: majors, error: mErr } = await db.from('workstream_majors').select('key, workstream, label')
  if (mErr) throw mErr
  const known = new Set((majors ?? []).map(m => m.key))
  const missing = [...new Set(PLAN.map(r => r[0]).filter(k => !known.has(k)))]
  if (missing.length) console.warn(`  (skipping unknown majors: ${missing.join(', ')})`)

  const rows = PLAN.filter(([k]) => known.has(k)).map(
    ([major_key, label, endOff, baseOff, status, weight, critical, ord]) => ({
      project_id: pid,
      major_key,
      label,
      end_date: day(endOff),
      baseline_date: day(baseOff),
      status,
      completed_at: status === 'complete' ? new Date().toISOString() : null,
      weight_pct: weight,
      is_critical: critical,
      sort_order: ord,
    }))

  const { error: insErr } = await db.from('workstream_milestones').insert(rows)
  if (insErr) throw insErr

  // ── owners on every major, so the board's Owner column fills in ──
  if (owner) {
    const { error: sErr } = await db.from('workstream_major_state').upsert(
      (majors ?? []).map(m => ({ project_id: pid, major_key: m.key, owner_id: owner })),
      { onConflict: 'project_id,major_key' })
    if (sErr) console.warn('  (could not set owners:', sErr.message, ')')
  }

  // ── weekly notes, for the expanded card and the complexity scorer ──
  const notes = NOTES.filter(([, k]) => known.has(k)).map(([workstream, major_key, body], i) => ({
    project_id: pid,
    workstream,
    major_key,
    body,
    created_by: owner,
    // Staggered over the last fortnight so they read as a run of updates.
    created_at: new Date(Date.now() - (i * 3 + 1) * 86400000).toISOString(),
  }))
  if (notes.length) {
    const { error: nErr } = await db.from('workstream_updates').insert(notes)
    if (nErr) console.warn('  (could not add weekly notes:', nErr.message, ')')
  }

  console.log(`Seeded ${PROJECT_NAME}`)
  console.log(`  project   ${pid}`)
  console.log(`  milestones ${rows.length}  ·  weekly notes ${notes.length}`)
  console.log(`  owner     ${owner ?? '(none found)'}`)
}

const mode = process.argv.includes('--drop') ? drop : seed
mode().catch(e => { console.error('Failed:', e.message ?? e); process.exit(1) })
