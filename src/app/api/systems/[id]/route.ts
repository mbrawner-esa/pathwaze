import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { changedDesignFields, areaLinksChanged, fieldLabel } from '@/lib/system-revisions'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  // building_ids is a virtual field (synced into the system_buildings join table),
  // not a column on systems — pull it out before updating the row.
  // design_rev* is server-owned: the revision is derived from what changed, never
  // supplied by the client.
  const {
    building_ids,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    design_rev: _rev, design_rev_at: _revAt, design_rev_by: _revBy,
    ...cols
  } = body as {
    building_ids?: string[]
    design_rev?: unknown; design_rev_at?: unknown; design_rev_by?: unknown
    [k: string]: unknown
  }

  // Read the current row (+ its area links) so the revision only advances when a
  // design-defining value actually changed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('systems') as any)
    .select('*, system_buildings(building_id)').eq('id', id).single()

  const changed = changedDesignFields(before ?? {}, cols)
  if (Array.isArray(building_ids)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prevAreas: string[] = Array.isArray(before?.system_buildings)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (before.system_buildings as any[]).map(j => j.building_id)
      : []
    if (areaLinksChanged(prevAreas, building_ids.filter(Boolean))) changed.push('building_ids')
  }

  const now = new Date().toISOString()
  const revPatch = changed.length
    ? { design_rev: ((before?.design_rev as number) ?? 1) + 1, design_rev_at: now, design_rev_by: user.id }
    : {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('systems') as any)
    .update({ ...cols, ...revPatch, updated_at: now })
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

  // A design change is logged as 'revised' (with what moved); everything else —
  // a rename, a status change, a meter re-link — stays a plain 'updated'.
  await logActivity(supabase, user, {
    entity_type: 'system',
    entity_id: id,
    action: changed.length ? 'revised' : 'updated',
    project_id: data.project_id,
    metadata: changed.length
      ? { name: data.name, design_rev: data.design_rev, changed: changed.map(fieldLabel) }
      : { name: data.name },
  })
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
