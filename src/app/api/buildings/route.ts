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
  const { data, error } = await (supabase.from('buildings') as any)
    .insert({
      project_id: body.project_id,
      name: body.name,
      category: body.category || 'Building',
      parcel_id: body.parcel_id || null,
      address: body.address || null,
      city: body.city || null,
      state: body.state || null,
      zip: body.zip || null,
      county: body.county || null,
      owner_name: body.owner_name || null,
      ahj: body.ahj || null,
      zoning_type: body.zoning_type || null,
      land_use_type: body.land_use_type || null,
      year_built: body.year_built ?? null,
      total_sqft: body.total_sqft ?? null,
      num_stories: body.num_stories ?? null,
      roof_type: body.roof_type || null,
      roof_age: body.roof_age ?? null,
      roof_manufacturer: body.roof_manufacturer || null,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, user, { entity_type: 'building', entity_id: data.id, action: 'created', project_id: data.project_id, metadata: { name: data.name } })
  return NextResponse.json({ building: data })
}
