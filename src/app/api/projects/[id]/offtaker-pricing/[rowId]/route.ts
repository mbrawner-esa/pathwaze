import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, rowId } = await params
  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) update[k] = v
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Mutual-exclusion for is_selected: only one row per project may be selected.
  if (update.is_selected === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('offtaker_pricing') as any)
      .update({ is_selected: false }).eq('project_id', id).neq('id', rowId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('offtaker_pricing') as any)
    .update(update).eq('id', rowId).eq('project_id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, rowId } = await params
  const { error } = await supabase.from('offtaker_pricing').delete().eq('id', rowId).eq('project_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
