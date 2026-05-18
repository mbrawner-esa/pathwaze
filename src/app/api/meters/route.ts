import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.project_id || !body.meter_num) {
    return NextResponse.json({ error: 'project_id and meter_num are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('meters') as any)
    .insert({
      project_id: body.project_id,
      building_id: body.building_id || null,
      meter_num: body.meter_num,
      account_num: body.account_num || null,
      utility: body.utility || null,
      rate_schedule: body.rate_schedule || null,
      annual_usage_kwh: body.annual_usage_kwh ?? null,
      peak_demand_kw: body.peak_demand_kw ?? null,
      blended_rate: body.blended_rate ?? null,
      annual_spend: body.annual_spend ?? null,
      status: body.status || 'Active',
      included: body.included ?? true,
      ix_app_num: body.ix_app_num || null,
      ix_status: body.ix_status || null,
      ix_voltage: body.ix_voltage || null,
      ix_feasibility: body.ix_feasibility || null,
      ix_cost_estimate: body.ix_cost_estimate ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, user, { entity_type: 'meter', entity_id: data.id, action: 'created', project_id: data.project_id, metadata: { meter_num: data.meter_num } })
  return NextResponse.json({ meter: data })
}
