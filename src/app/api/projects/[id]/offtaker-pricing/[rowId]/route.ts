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
  'quote_created_at',
])

// Subset of fields where a change is interesting enough to log to activity_log.
// Skip noisy fields like notes (long text) and is_selected (separate UX).
const LOGGABLE = new Set([
  'version_label', 'revenue_type', 'term_months',
  'year1_contract_price', 'escalation_rate', 'srec_treatment',
  'estimated_ntp', 'estimated_cod', 'utility_escalation_rate',
  'customer_term_savings', 'customer_term_npv', 'quote_created_at',
  'linked_system_ids', 'meter_savings',
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, rowId } = await params
  const body = await req.json()

  // Fetch before-state so we can diff for version tracking + activity log.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await supabase
    .from('offtaker_pricing')
    .select('*')
    .eq('id', rowId)
    .eq('project_id', id)
    .single() as { data: any }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k)) update[k] = v
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Detect real field changes (not just updated_at), and increment version
  // if any of the loggable fields actually changed.
  const changedFields: string[] = []
  for (const k of Object.keys(update)) {
    if (k === 'updated_at') continue
    if (LOGGABLE.has(k)) {
      const a = before ? JSON.stringify(before[k] ?? null) : 'null'
      const b = JSON.stringify(update[k] ?? null)
      if (a !== b) changedFields.push(k)
    }
  }
  if (changedFields.length > 0 && before) {
    update.version = (before.version ?? 1) + 1
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

  // ── Activity log: one entry per changed field. metadata.project_id makes
  // these show up in the project's existing activity feed without any
  // changes to the feed component. ──
  if (changedFields.length > 0) {
    try {
      // Ensure a public.users row exists for the auth user (FK requirement).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('users') as any).upsert({
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: 'team',
      }, { onConflict: 'id', ignoreDuplicates: true })

      const entries = changedFields.map(field => ({
        entity_type: 'offtaker_pricing',
        entity_id: rowId,
        action: 'field_changed',
        user_id: user.id,
        metadata: {
          field,
          from: before?.[field] ?? null,
          to: update[field] ?? null,
          project_id: id,
          option_label: data.version_label,
          new_version: data.version,
        },
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_log') as any).insert(entries)
    } catch (e) {
      console.warn('[offtaker_pricing] activity log write failed:', e)
    }
  }

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
