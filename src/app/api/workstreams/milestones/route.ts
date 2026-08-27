import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

// Milestones are the user-editable level of Workstreams. Major milestones are
// catalog rows and are never written here; the work under a milestone is
// ordinary tasks, created through /api/tasks.

/** POST — create a milestone under a major. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, major_key, label } = body as {
    project_id?: string; major_key?: string; label?: string
  }

  if (!project_id || !major_key || !label?.trim()) {
    return NextResponse.json({ error: 'project_id, major_key and label are required' }, { status: 400 })
  }

  const weight = Number(body.weight_pct ?? 0)
  if (Number.isNaN(weight) || weight < 0 || weight > 100) {
    return NextResponse.json({ error: 'Weight must be between 0 and 100' }, { status: 400 })
  }

  // New milestones land at the end of their major's list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: siblings } = await (supabase.from('workstream_milestones') as any)
    .select('sort_order')
    .eq('project_id', project_id)
    .eq('major_key', major_key)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = ((siblings?.[0]?.sort_order as number | undefined) ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestones') as any)
    .insert({
      project_id,
      major_key,
      label: label.trim(),
      description: body.description || null,
      stage_gate: body.stage_gate || null,
      weight_pct: weight,
      is_critical: !!body.is_critical,
      end_date: body.end_date || null,
      // The first target set is the baseline, so the original commitment is
      // recorded from the outset rather than backfilled later.
      baseline_date: body.end_date || null,
      sort_order: nextOrder,
      created_by: user.id,
    }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'workstream_milestone',
    entity_id: data.id,
    action: 'milestone_created',
    project_id,
    metadata: { label: data.label, major_key },
  })

  return NextResponse.json(data)
}

/**
 * PATCH — batch reorder (drag-to-reprioritize). Takes the ids in their new
 * order and rewrites sort_order to match, so the client never has to compute
 * gap values.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await request.json() as { ids?: string[] }
  if (!Array.isArray(ids) || !ids.length) {
    return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }

  for (let i = 0; i < ids.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('workstream_milestones') as any)
      .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
      .eq('id', ids[i])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, count: ids.length })
}
