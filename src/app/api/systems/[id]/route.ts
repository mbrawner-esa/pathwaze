import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // building_ids is a virtual field (synced into the system_buildings join table),
  // not a column on systems — pull it out before updating the row.
  const { building_ids, ...cols } = body as { building_ids?: string[]; [k: string]: unknown }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('systems') as any)
    .update({ ...cols, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-sync the many-to-many area links when building_ids is provided.
  if (Array.isArray(building_ids)) {
    const ids = building_ids.filter(Boolean)
    await supabase.from('system_buildings').delete().eq('system_id', id)
    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: joinErr } = await (supabase.from('system_buildings') as any)
        .insert(ids.map(bid => ({ system_id: id, building_id: bid })))
      if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 500 })
    }
  }
  await logActivity(supabase, user, { entity_type: 'system', entity_id: id, action: 'updated', project_id: data.project_id, metadata: { name: data.name } })
  return NextResponse.json({ system: data })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data: before } = await supabase.from('systems').select('project_id, name').eq('id', id).single() as { data: { project_id: string; name: string } | null }
  const { error } = await supabase.from('systems').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (before) await logActivity(supabase, user, { entity_type: 'system', entity_id: id, action: 'deleted', project_id: before.project_id, metadata: { name: before.name } })
  return NextResponse.json({ success: true })
}
