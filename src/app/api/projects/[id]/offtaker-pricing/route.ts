import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Fields a client can write — keeps the endpoint safe from accidental writes
// to id, project_id, created_at, etc.
const ALLOWED = new Set([
  'version_label', 'is_selected',
  'revenue_type', 'term_months',
  'year1_contract_price', 'escalation_rate', 'srec_treatment',
  'notes',
  // v2 fields
  'linked_system_ids', 'meter_savings',
  'estimated_ntp', 'estimated_cod',
  'utility_escalation_rate',
  'customer_term_savings', 'customer_term_npv',
])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('offtaker_pricing')
    .select('*')
    .eq('project_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const row: Record<string, unknown> = { project_id: id, created_by: user.id }
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) row[k] = v
  }
  if (!row.version_label) {
    // Auto-name new options as "Option A", "Option B", etc. based on count.
    const { count } = await supabase
      .from('offtaker_pricing')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', id) as { count: number | null }
    const letter = String.fromCharCode('A'.charCodeAt(0) + (count ?? 0))
    row.version_label = `Option ${letter}`
  }
  // Pre-populate per-proposal dates from the project's master schedule.
  // Each proposal can edit them independently after. Note: target_cod is
  // a free-form TEXT column on projects (defaults to "TBD"), so we only
  // copy it forward if it parses as a real ISO date.
  if (row.estimated_ntp === undefined || row.estimated_cod === undefined) {
    const { data: proj } = await supabase
      .from('projects')
      .select('start_date, target_cod')
      .eq('id', id)
      .single() as { data: { start_date?: string | null; target_cod?: string | null } | null }
    const asDate = (s?: string | null): string | null => {
      if (!s) return null
      // Accept ISO yyyy-mm-dd (or longer timestamp) — anything else (e.g., "TBD") is ignored.
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
    }
    if (row.estimated_ntp === undefined) row.estimated_ntp = asDate(proj?.start_date) ?? undefined
    if (row.estimated_cod === undefined) row.estimated_cod = asDate(proj?.target_cod) ?? undefined
  }

  // If incoming row says is_selected, clear the flag on any existing rows first.
  if (row.is_selected === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('offtaker_pricing') as any).update({ is_selected: false }).eq('project_id', id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('offtaker_pricing') as any)
    .insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
