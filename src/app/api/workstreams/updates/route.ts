import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { parseMentions, emailUser } from '@/lib/rfi-notify'
import { appUrl } from '@/lib/slack'

/**
 * POST — log a weekly update against a workstream (optionally a specific major).
 *
 * Append-only: there is no PATCH. The history is the point — it is what feeds
 * the priority dashboard (R-2) and Reports (R-8).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, workstream, major_key, body } = await request.json() as {
    project_id?: string; workstream?: string; major_key?: string | null; body?: string
  }

  if (!project_id || !workstream || !body?.trim()) {
    return NextResponse.json({ error: 'project_id, workstream and body are required' }, { status: 400 })
  }
  if (!['commercial', 'technical', 'approvals'].includes(workstream)) {
    return NextResponse.json({ error: 'Unknown workstream' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_updates') as any)
    .insert({
      project_id,
      workstream,
      major_key: major_key ?? null,
      body,
      created_by: user.id,
    }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'workstream_milestone',
    entity_id: data.id,
    action: 'weekly_update_logged',
    project_id,
    metadata: { workstream, major_key: major_key ?? null },
  })

  // The composer uses RichTextEditor's @-autocomplete, so mentions arrive as
  // data-uid spans — parseMentions, not parseTokenMentions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project } = await (supabase.from('projects') as any)
    .select('name').eq('id', project_id).single()

  const mentioned = parseMentions(body).filter(id => id !== user.id)
  for (const id of mentioned) {
    await emailUser(supabase, id, {
      subject: `You were mentioned in a ${workstream} update on ${project?.name ?? 'a project'}`,
      heading: 'You were mentioned in a workstream update',
      message: body,
      ctaLabel: 'Open Workstreams',
      ctaUrl: appUrl(`/projects/${project_id}?tab=workstreams`),
    })
  }

  return NextResponse.json(data)
}
