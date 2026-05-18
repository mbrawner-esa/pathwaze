import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.project_id || !body.name) {
    return NextResponse.json({ error: 'project_id and name are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('systems') as any)
    .insert({
      project_id: body.project_id,
      building_id: body.building_id || null,
      meter_id: body.meter_id || null,
      name: body.name,
      design_version: body.design_version || 'v1.0',
      design_status: body.design_status || 'Not Started',
      system_type: body.system_type || null,
      size_kwdc: body.size_kwdc ?? 0,
      size_kwac: body.size_kwac ?? 0,
      yield_kwh_kwp: body.yield_kwh_kwp ?? null,
      annual_production_kwh: body.annual_production_kwh ?? 0,
      performance_ratio: body.performance_ratio ?? 0.80,
      num_modules: body.num_modules ?? null,
      num_inverters: body.num_inverters ?? null,
      module_wattage: body.module_wattage ?? null,
      inverter_rating: body.inverter_rating ?? null,
      design_url: body.design_url || null,
      modules: body.modules || null,
      inverters: body.inverters || null,
      monitoring: body.monitoring || null,
      racking: body.racking || null,
      azimuth: body.azimuth || null,
      tilt: body.tilt || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, user, { entity_type: 'system', entity_id: data.id, action: 'created', project_id: data.project_id, metadata: { name: data.name } })
  return NextResponse.json({ system: data })
}
