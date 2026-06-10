import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { parseMentions, emailUser } from '@/lib/rfi-notify'
import { appUrl } from '@/lib/slack'

// POST a note / event / file metadata for the project.
// File-type entries assume the binary is already uploaded to the
// project-files Storage bucket; we just record metadata here.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const body = await request.json()
  const type: string = body.type === 'event' || body.type === 'file' ? body.type : 'note'

  const payload: Record<string, unknown> = {
    project_id: projectId,
    user_id: user.id,
    type,
    title: body.title || null,
    body: body.body || null,
    event_date: body.event_date || null,
    storage_path: body.storage_path || null,
    file_name: body.file_name || null,
    file_size: body.file_size ?? null,
    content_type: body.content_type || null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('project_notes') as any)
    .insert(payload)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'project',
    entity_id: projectId,
    action: type === 'event' ? 'event_added' : type === 'file' ? 'file_added' : 'note_added',
    project_id: projectId,
    metadata: { type, title: payload.title, file_name: payload.file_name },
  })

  // @-mentions in the note body → notify each mentioned user (feed + email).
  const mentioned = parseMentions((body.body as string) || '').filter(uid => uid !== user.id)
  for (const uid of mentioned) {
    await logActivity(supabase, user, { entity_type: 'project', entity_id: projectId, action: 'mentioned you in a note', project_id: projectId, metadata: { mentioned_user_id: uid } })
    await emailUser(supabase, uid, { subject: 'You were mentioned in a project note', heading: 'You were mentioned', message: `You were mentioned in a project note${payload.title ? ` — <b>${payload.title}</b>` : ''}.`, ctaLabel: 'Open project', ctaUrl: appUrl(`/projects/${projectId}`) })
  }

  return NextResponse.json({ note: data })
}
