import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body.project_id || !body.name) {
    return NextResponse.json({ error: 'project_id and name (permit type) are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('permits') as any)
    .insert({
      project_id: body.project_id,
      name: body.name,
      category: body.category || 'Ministerial',
      level: body.level || 'Local',
      status: body.status || 'Not Started',
      ahj: body.ahj || null,
      permit_number: body.permit_number || null,
      inspector: body.inspector || null,
      required: body.required ?? true,
      stage: body.stage || null,
      est_cost: body.est_cost ?? null,
      est_review_days: body.est_review_days ?? null,
      submitted_at: body.submitted_at || null,
      approved_at: body.approved_at || null,
      expiry_date: body.expiry_date || null,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logActivity(supabase, user, { entity_type: 'permit', entity_id: data.id, action: 'created', project_id: data.project_id, metadata: { name: data.name } })
  return NextResponse.json({ permit: data })
}
