import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

// Stage gates and key objectives. Per-project and fully editable — the catalog
// (workstream_gate_templates) only seeds the starting set.

/** POST — add a gate or objective to a major. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, major_key, kind, label } = await request.json() as {
    project_id?: string; major_key?: string; kind?: string; label?: string
  }

  if (!project_id || !major_key || !label?.trim()) {
    return NextResponse.json({ error: 'project_id, major_key and label are required' }, { status: 400 })
  }
  if (kind !== 'gate' && kind !== 'objective') {
    return NextResponse.json({ error: 'kind must be gate or objective' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siblings } = await (supabase.from('workstream_gates') as any)
    .select('sort_order')
    .eq('project_id', project_id).eq('major_key', major_key).eq('kind', kind)
    .order('sort_order', { ascending: false }).limit(1)
  const nextOrder = ((siblings?.[0]?.sort_order as number | undefined) ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_gates') as any)
    .insert({
      project_id, major_key, kind,
      label: label.trim(),
      sort_order: nextOrder,
      updated_by: user.id,
    }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'workstream_milestone',
    entity_id: data.id,
    action: kind === 'gate' ? 'gate_added' : 'objective_added',
    project_id,
    metadata: { label: data.label, major_key },
  })

  return NextResponse.json(data)
}

/** PATCH — rename a gate/objective, or change its pass/fail state. */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, label, status } = await request.json() as {
    id?: string; label?: string; status?: string
  }

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (status !== undefined && !['open', 'pass', 'fail'].includes(status)) {
    return NextResponse.json({ error: 'status must be open, pass or fail' }, { status: 400 })
  }
  if (label !== undefined && !label.trim()) {
    return NextResponse.json({ error: 'Label cannot be empty' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }
  if (label !== undefined) update.label = label.trim()
  if (status !== undefined) update.status = status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('workstream_gates') as any)
    .select('*').eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_gates') as any)
    .update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only the pass/fail transition is logged — a gate closing is a project
  // event. Renaming one is housekeeping.
  if (status !== undefined && status !== before.status) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: id,
      action: 'gate_status_changed',
      project_id: before.project_id,
      metadata: { label: data.label, kind: before.kind, major_key: before.major_key, from: before.status, to: status },
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('workstream_gates') as any)
    .select('project_id, label, kind, major_key').eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_gates') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'workstream_milestone',
    entity_id: id,
    action: before.kind === 'gate' ? 'gate_deleted' : 'objective_deleted',
    project_id: before.project_id,
    metadata: { label: before.label, major_key: before.major_key },
  })

  return NextResponse.json({ ok: true })
}
