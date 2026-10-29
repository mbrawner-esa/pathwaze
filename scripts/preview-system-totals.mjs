// What migration 077 will do to every project's System Size, before you run it.
//
//   node scripts/preview-system-totals.mjs
//
// 077 makes projects.system_kwdc / system_kwac / annual_production_kwh derived:
// the sum over that project's `systems` rows where design_status = 'Approved'.
// This prints the stored figure next to that sum so the change is visible
// first — in particular any project whose designs are not yet Approved, which
// will drop to 0 until someone marks them.
//
// Read-only. Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
// .env.local, and runs against the shared database (CLAUDE.md).

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const db = createClient(url, key, { auth: { persistSession: false } })

const { data: projects, error: pErr } = await db
  .from('projects')
  .select('id, project_number, name, stage, system_kwdc')
  .order('name')
if (pErr) throw new Error(pErr.message)

const { data: systems, error: sErr } = await db
  .from('systems')
  .select('project_id, design_status, size_kwdc')
if (sErr) throw new Error(sErr.message)

const byProject = new Map()
for (const s of systems) {
  const agg = byProject.get(s.project_id) ?? { all: 0, approved: 0, n: 0, nApproved: 0 }
  agg.all += s.size_kwdc ?? 0
  agg.n += 1
  if (s.design_status === 'Approved') {
    agg.approved += s.size_kwdc ?? 0
    agg.nApproved += 1
  }
  byProject.set(s.project_id, agg)
}

const fmt = n => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
const rows = projects.map(p => {
  const agg = byProject.get(p.id) ?? { all: 0, approved: 0, n: 0, nApproved: 0 }
  return {
    Project: `${p.project_number} ${p.name}`.slice(0, 44),
    Stage: p.stage,
    Designs: `${agg.nApproved}/${agg.n}`,
    'Stored kWdc': fmt(p.system_kwdc),
    'All designs': fmt(agg.all),
    'After 077': fmt(agg.approved),
    Change: Number(p.system_kwdc ?? 0) === agg.approved ? 'same' : `${fmt(agg.approved - Number(p.system_kwdc ?? 0))}`,
  }
})
console.table(rows)

const storedTotal = projects.reduce((s, p) => s + Number(p.system_kwdc ?? 0), 0)
const afterTotal = projects.reduce((s, p) => s + (byProject.get(p.id)?.approved ?? 0), 0)
const zeroed = rows.filter(r => r['After 077'] === '0' && r['Stored kWdc'] !== '0').length
console.log(`\nPortfolio kWdc  stored ${fmt(storedTotal)}  →  after 077 ${fmt(afterTotal)}`)
console.log(`Projects dropping to 0 (no approved design): ${zeroed}`)
