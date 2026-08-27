import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

// Cross-workstream links: the milestones an exit gate depends on. A Commercial
// gate can wait on a Technical milestone, which is the point — this is the
// mechanism for dependencies that span workstreams.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gate_id, milestone_id } = await request.json() as {
    gate_id?: string; milestone_id?: string
  }
  if (!gate_id || !milestone_id) {
    return NextResponse.json({ error: 'gate_id and milestone_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_gate_links') as any)
    .insert({ gate_id, milestone_id, created_by: user.id }).select().single()

  if (error) {
    // The same-project guard is a trigger and a repeat link trips the primary
    // key — both are client mistakes, so answer 400 with the real reason.
    const message = /same project/i.test(error.message)
      ? 'The gate and milestone must belong to the same project'
      : /duplicate key/i.test(error.message)
        ? 'That milestone is already linked to this gate'
        : error.message
    const client = /same project|duplicate key/i.test(error.message)
    return NextResponse.json({ error: message }, { status: client ? 400 : 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gate } = await (supabase.from('workstream_gates') as any)
    .select('project_id, label, major_key').eq('id', gate_id).single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: milestone } = await (supabase.from('workstream_milestones') as any)
    .select('label, major_key').eq('id', milestone_id).single()

  if (gate) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: gate_id,
      action: 'gate_link_added',
      project_id: gate.project_id,
      metadata: {
        label: gate.label,
        major_key: gate.major_key,
        milestone_label: milestone?.label ?? null,
        // The linked milestone's major is what makes this cross-workstream, so
        // the feed can say where the requirement came from.
        milestone_major_key: milestone?.major_key ?? null,
      },
    })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const gate_id = request.nextUrl.searchParams.get('gate_id')
  const milestone_id = request.nextUrl.searchParams.get('milestone_id')
  if (!gate_id || !milestone_id) {
    return NextResponse.json({ error: 'gate_id and milestone_id are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_gate_links') as any)
    .delete().eq('gate_id', gate_id).eq('milestone_id', milestone_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gate } = await (supabase.from('workstream_gates') as any)
    .select('project_id, label, major_key').eq('id', gate_id).single()
  if (gate) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: gate_id,
      action: 'gate_link_removed',
      project_id: gate.project_id,
      metadata: { label: gate.label, major_key: gate.major_key },
    })
  }

  return NextResponse.json({ ok: true })
}
