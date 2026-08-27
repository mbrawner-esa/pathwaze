import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postToChannel, projectStageChangedBlocks } from '@/lib/slack'
import { logActivity } from '@/lib/activity'

// Project fields that should be logged to activity_log when they change, with a
// friendly label and the tab (category) their edits belong to. Fields absent
// here (e.g. slack_channel_id, archived_at) are not logged. 'overview' fields
// (stage, deal_health, …) are logged for the portfolio/priority history and the
// bell feed but don't map to a per-tab activity feed.
const FIELD_META: Record<string, { category: string; label: string }> = {
  name: { category: 'overview', label: 'name' },
  customer: { category: 'overview', label: 'customer' },
  stage: { category: 'overview', label: 'stage' },
  deal_health: { category: 'overview', label: 'deal health' },
  assignee_id: { category: 'overview', label: 'assignee' },
  primary_stakeholder_id: { category: 'overview', label: 'primary contact' },
  tranche: { category: 'overview', label: 'tranche' },
  region: { category: 'overview', label: 'region' },
  start_date: { category: 'overview', label: 'start date' },
  target_cod: { category: 'overview', label: 'target COD' },
  // Site
  address: { category: 'site', label: 'address' },
  city: { category: 'site', label: 'city' },
  state: { category: 'site', label: 'state' },
  zip: { category: 'site', label: 'ZIP' },
  lat: { category: 'site', label: 'latitude' },
  lng: { category: 'site', label: 'longitude' },
  facility_type: { category: 'site', label: 'facility type' },
  site_type: { category: 'site', label: 'site type' },
  site_acres: { category: 'site', label: 'site acres' },
  roof_type: { category: 'site', label: 'roof type' },
  // Utility
  utility: { category: 'utility', label: 'utility' },
  rate_schedule: { category: 'utility', label: 'rate schedule' },
  rate_schedule_type: { category: 'utility', label: 'rate schedule type' },
  annual_usage_kwh: { category: 'utility', label: 'annual usage' },
  peak_demand_kw: { category: 'utility', label: 'peak demand' },
  nem_program: { category: 'utility', label: 'NEM program' },
  utility_poc: { category: 'utility', label: 'utility contact' },
  interconnection_num: { category: 'utility', label: 'interconnection #' },
  interconnection_status: { category: 'utility', label: 'interconnection status' },
  interconnection_voltage: { category: 'utility', label: 'interconnection voltage' },
  interconnection_feasibility: { category: 'utility', label: 'interconnection feasibility' },
  interconnection_cost_estimate: { category: 'utility', label: 'interconnection cost' },
  // Technical
  system_kwdc: { category: 'technical', label: 'system kWdc' },
  system_kwac: { category: 'technical', label: 'system kWac' },
  annual_production_kwh: { category: 'technical', label: 'annual production' },
  modules: { category: 'technical', label: 'modules' },
  inverters: { category: 'technical', label: 'inverters' },
  monitoring: { category: 'technical', label: 'monitoring' },
  azimuth: { category: 'technical', label: 'azimuth' },
  tilt: { category: 'technical', label: 'tilt' },
  // Permitting
  ahj: { category: 'permitting', label: 'AHJ' },
  building_permit_num: { category: 'permitting', label: 'building permit #' },
  building_permit_status: { category: 'permitting', label: 'building permit status' },
  electrical_permit_num: { category: 'permitting', label: 'electrical permit #' },
  permit_submitted: { category: 'permitting', label: 'permit submitted' },
  permit_approved: { category: 'permitting', label: 'permit approved' },
  inspector: { category: 'permitting', label: 'inspector' },
}

// Whitelist of project columns that can be updated via this endpoint.
// Keeps the endpoint safe from accidental writes to id, project_number, etc.
const ALLOWED_FIELDS = new Set([
  'name', 'customer', 'stage', 'deal_health',
  'system_kwdc', 'system_kwac', 'annual_production_kwh',
  'address', 'city', 'state', 'zip', 'lat', 'lng',
  'utility', 'rate_schedule', 'rate_schedule_type',
  'annual_usage_kwh', 'peak_demand_kw',
  'interconnection_num', 'interconnection_status', 'interconnection_voltage',
  'interconnection_feasibility', 'interconnection_cost_estimate',
  'nem_program', 'utility_poc',
  'ahj', 'building_permit_num', 'building_permit_status',
  'electrical_permit_num', 'permit_submitted', 'permit_approved', 'inspector',
  'assignee_id', 'facility_type', 'site_type', 'site_acres', 'roof_type',
  'modules', 'inverters', 'monitoring', 'azimuth', 'tilt',
  'start_date', 'target_cod', 'tranche', 'region', 'deal_health_override',
  'slack_channel_id', 'archived_at', 'primary_stakeholder_id',
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // Filter to only allowed fields and pass through
  const update: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      // Empty string for nullable date columns → null (Postgres rejects empty string for date type)
      if ((key === 'permit_submitted' || key === 'permit_approved' || key === 'start_date' || key === 'target_cod') && val === '') {
        update[key] = null
      } else {
        update[key] = val
      }
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Fetch before-state so we can diff stage for Slack + log field changes.
  const { data: before } = await supabase.from('projects').select('*').eq('id', id).single()

  // on_hold_at follows the stage rather than being a field anyone sets. The stage
  // IS the signal, so a second control would only let the two disagree — a
  // project reading "On Hold" while its schedule kept accruing variance.
  if (update.stage !== undefined) {
    const wasHeld = (before as { stage?: string } | null)?.stage === 'On Hold'
    const nowHeld = update.stage === 'On Hold'
    if (nowHeld && !wasHeld) update.on_hold_at = new Date().toISOString()
    if (!nowHeld && wasHeld) update.on_hold_at = null
  }

  // Archive / unarchive is admin-only (defense in depth — UI already hides the
  // menu items for non-admins, but block at the API too).
  const isArchiveAction =
    (update.stage === 'Archived') ||
    (update.stage !== undefined && (before as { stage?: string } | null)?.stage === 'Archived') ||
    (update.archived_at !== undefined)
  if (isArchiveAction) {
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can archive or unarchive projects' }, { status: 403 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('projects') as any).update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Slack: stage change → post in linked channel ──
  try {
    const channelId = data.slack_channel_id ?? (before as { slack_channel_id?: string } | null)?.slack_channel_id
    if (update.stage !== undefined && before && (before as { stage?: string }).stage !== update.stage && channelId) {
      const actorName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone'
      const { text, blocks } = projectStageChangedBlocks({
        projectName: data.name,
        from: (before as { stage?: string }).stage ?? '—',
        to: update.stage as string,
        changedBy: actorName,
        projectPath: `/projects/${id}`,
      })
      await postToChannel(channelId, text, blocks)
    }
  } catch (e) {
    console.warn('[slack] project stage notify failed:', e)
  }

  // ── Activity log: record each changed project field (routes to its tab feed) ──
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beforeRow = (before ?? {}) as Record<string, any>
    for (const key of Object.keys(update)) {
      const meta = FIELD_META[key]
      if (!meta) continue
      const from = beforeRow[key]
      const to = update[key]
      if (String(from ?? '') === String(to ?? '')) continue   // unchanged
      await logActivity(supabase, user, {
        entity_type: 'project',
        entity_id: id,
        action: 'field_changed',
        project_id: id,
        metadata: { field: key, label: meta.label, category: meta.category, from: from ?? null, to: to ?? null },
      })
    }
  } catch (e) {
    console.warn('[activity] project field log failed:', e)
  }

  return NextResponse.json(data)
}

// Hard-delete with cascade. Admin-only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Only admins can delete projects' }, { status: 403 })

  const { id } = await params
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
