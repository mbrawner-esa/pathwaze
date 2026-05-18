import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postToChannel, projectStageChangedBlocks } from '@/lib/slack'

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
  'start_date', 'target_cod', 'tranche', 'region',
  'slack_channel_id',
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

  // Fetch before-state so we can diff stage for Slack
  const { data: before } = await supabase.from('projects').select('stage, slack_channel_id, name').eq('id', id).single()

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

  return NextResponse.json(data)
}
