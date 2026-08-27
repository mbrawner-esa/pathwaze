import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

// Dependency edges between milestones. Edges may cross workstreams; the DB
// enforces same-project and rejects cycles.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { milestone_id, depends_on } = await request.json() as { milestone_id?: string; depends_on?: string }
  if (!milestone_id || !depends_on) {
    return NextResponse.json({ error: 'milestone_id and depends_on are required' }, { status: 400 })
  }
  if (milestone_id === depends_on) {
    return NextResponse.json({ error: 'A milestone cannot depend on itself' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestone_deps') as any)
    .insert({ milestone_id, depends_on }).select().single()

  if (error) {
    // The cycle and same-project guards are triggers, and a duplicate edge trips
    // the primary key. All three are client mistakes -> 400 with the real reason,
    // so the UI can show something better than "failed".
    const message = /cycle/i.test(error.message)
      ? 'That dependency would create a loop'
      : /same project/i.test(error.message)
        ? 'Both milestones must belong to the same project'
        : /duplicate key/i.test(error.message)
          ? 'That dependency already exists'
          : error.message
    const client = /cycle|same project|duplicate key/i.test(error.message)
    return NextResponse.json({ error: message }, { status: client ? 400 : 500 })
  }

  // major_key is carried on every workstream activity row — it is what scopes an
  // event to a major's update thread.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase.from('workstream_milestones') as any)
    .select('project_id, label, major_key').eq('id', milestone_id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pred } = await (supabase.from('workstream_milestones') as any)
    .select('label').eq('id', depends_on).single()

  if (milestone) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: milestone_id,
      action: 'dependency_added',
      project_id: milestone.project_id,
      metadata: {
        label: milestone.label,
        major_key: milestone.major_key,
        depends_on_label: pred?.label ?? null,
      },
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Read from the query string: DELETE bodies are awkward for callers and some
  // proxies drop them.
  const milestone_id = request.nextUrl.searchParams.get('milestone_id')
  const depends_on = request.nextUrl.searchParams.get('depends_on')
  if (!milestone_id || !depends_on) {
    return NextResponse.json({ error: 'milestone_id and depends_on are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestone_deps') as any)
    .delete().eq('milestone_id', milestone_id).eq('depends_on', depends_on)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase.from('workstream_milestones') as any)
    .select('project_id, label, major_key').eq('id', milestone_id).single()
  if (milestone) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: milestone_id,
      action: 'dependency_removed',
      project_id: milestone.project_id,
      metadata: { label: milestone.label, major_key: milestone.major_key },
    })
  }

  return NextResponse.json({ ok: true })
}
