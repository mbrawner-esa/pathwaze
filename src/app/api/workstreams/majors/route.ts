import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { emailUser } from '@/lib/rfi-notify'
import { appUrl } from '@/lib/slack'

/**
 * PATCH — per-project state on a major milestone.
 *
 * The major itself is a catalog row and is not writable. The only per-project
 * fields are ownership (owner / co-owner — the "author and co-author" of that
 * section) and the one-shot completion-celebration marker.
 *
 * Upserts, so a project needs no seeded row until someone sets an owner.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, major_key } = body as { project_id?: string; major_key?: string }

  if (!project_id || !major_key) {
    return NextResponse.json({ error: 'project_id and major_key are required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('workstream_major_state') as any)
    .select('*').eq('project_id', project_id).eq('major_key', major_key).maybeSingle()

  const row: Record<string, unknown> = {
    project_id,
    major_key,
    owner_id: before?.owner_id ?? null,
    co_owner_id: before?.co_owner_id ?? null,
    celebrated_at: before?.celebrated_at ?? null,
    completed_at: before?.completed_at ?? null,
    completed_by: before?.completed_by ?? null,
    updated_at: new Date().toISOString(),
  }
  if (body.owner_id !== undefined) row.owner_id = body.owner_id || null
  if (body.co_owner_id !== undefined) row.co_owner_id = body.co_owner_id || null
  // The client sets this once, when it has just shown the completion
  // celebration, so the animation never replays on a later page load.
  if (body.celebrated === true) row.celebrated_at = new Date().toISOString()

  // Manual completion override. Reopening also clears the celebration marker so
  // finishing it again is celebrated again — otherwise the second completion
  // would land silently.
  if (body.completed === true) {
    row.completed_at = new Date().toISOString()
    row.completed_by = user.id
  } else if (body.completed === false) {
    row.completed_at = null
    row.completed_by = null
    row.celebrated_at = null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_major_state') as any)
    .upsert(row, { onConflict: 'project_id,major_key' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: major } = await (supabase.from('workstream_majors') as any)
    .select('label').eq('key', major_key).single()

  if (body.completed === true || body.completed === false) {
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: major_key,
      action: body.completed ? 'major_completed' : 'major_reopened',
      project_id,
      metadata: { label: major?.label ?? major_key, major_key },
    })
  }

  for (const field of ['owner_id', 'co_owner_id'] as const) {
    if (body[field] === undefined || (before?.[field] ?? null) === (row[field] ?? null)) continue

    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: major_key,
      action: field === 'owner_id' ? 'major_owner_changed' : 'major_co_owner_changed',
      project_id,
      metadata: { label: major?.label ?? major_key, major_key, to: row[field] },
    })

    // Tell someone they now own a section — being made owner without being told
    // is how ownership quietly means nothing.
    const newId = row[field] as string | null
    if (newId && newId !== user.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: project } = await (supabase.from('projects') as any)
        .select('name').eq('id', project_id).single()
      await emailUser(supabase, newId, {
        subject: `You're now ${field === 'owner_id' ? 'the owner' : 'a co-owner'} of ${major?.label ?? 'a milestone'}`,
        heading: field === 'owner_id' ? 'You own a major milestone' : 'You are a co-owner',
        message: `You were added to <b>${major?.label ?? major_key}</b> on ${project?.name ?? 'a project'}.`,
        ctaLabel: 'Open Workstreams',
        ctaUrl: appUrl(`/projects/${project_id}?tab=workstreams`),
      })
    }
  }

  return NextResponse.json(data)
}
