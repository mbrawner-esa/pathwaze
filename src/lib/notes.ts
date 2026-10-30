// Shared helper for creating project notes.
//
// Extracted verbatim from api/projects/[id]/notes/route.ts so the route and the
// MCP server (api/mcp) create notes through one code path rather than two that
// drift. Behaviour is unchanged: insert, log the activity, then notify anyone
// @-mentioned in the body.
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { logActivity } from './activity'
import { parseMentions, emailUser } from './rfi-notify'
import { appUrl } from './slack'

/**
 * Project tabs a note can be scoped to. A note with no category stays Threads-only.
 * Every tab that renders the note composer with a `category` must be listed here:
 * an unlisted one is coerced to null below, and the tab's own feed (which filters
 * on `category === activeTab`) then never shows the note.
 */
export const NOTE_CATEGORIES = [
  'workstreams',
  'site',
  'utility',
  'stakeholders',
  'permitting',
  'technical',
  'financial',
  'drawings',
] as const

export type NoteCategory = (typeof NOTE_CATEGORIES)[number]

export interface NewNoteInput {
  project_id: string
  /** 'note' | 'event' | 'file'; anything else is coerced to 'note'. */
  type?: string
  category?: string | null
  title?: string | null
  /** Storage-ready HTML. MCP callers pass markdown through richtext.ts first. */
  body?: string | null
  event_date?: string | null
  storage_path?: string | null
  file_name?: string | null
  file_size?: number | null
  content_type?: string | null
  /** 'mcp' when created by the connector; null from the app. */
  created_via?: string | null
}

/**
 * Create a project note and run its notifications.
 * Returns the created row, or throws with the Postgres error message.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNote(supabase: SupabaseClient<any>, user: User, input: NewNoteInput) {
  const type = input.type === 'event' || input.type === 'file' ? input.type : 'note'
  const category =
    typeof input.category === 'string' && (NOTE_CATEGORIES as readonly string[]).includes(input.category)
      ? input.category
      : null

  const payload: Record<string, unknown> = {
    project_id: input.project_id,
    user_id: user.id,
    type,
    category,
    title: input.title || null,
    body: input.body || null,
    event_date: input.event_date || null,
    storage_path: input.storage_path || null,
    file_name: input.file_name || null,
    file_size: input.file_size ?? null,
    content_type: input.content_type || null,
    created_via: input.created_via ?? null,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('project_notes') as any)
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await logActivity(supabase, user, {
    entity_type: 'project',
    entity_id: input.project_id,
    action: type === 'event' ? 'event_added' : type === 'file' ? 'file_added' : 'note_added',
    project_id: input.project_id,
    metadata: { type, title: payload.title, file_name: payload.file_name, category },
  })

  // @-mentions in the note body → notify each mentioned user (feed + email).
  const mentioned = parseMentions(input.body || '').filter((uid) => uid !== user.id)
  for (const uid of mentioned) {
    await logActivity(supabase, user, {
      entity_type: 'project',
      entity_id: input.project_id,
      action: 'mentioned you in a note',
      project_id: input.project_id,
      metadata: { mentioned_user_id: uid },
    })
    await emailUser(supabase, uid, {
      subject: 'You were mentioned in a project note',
      heading: 'You were mentioned',
      message: `You were mentioned in a project note${payload.title ? ` — <b>${payload.title}</b>` : ''}.`,
      ctaLabel: 'Open project',
      ctaUrl: appUrl(`/projects/${input.project_id}`),
    })
  }

  return data
}
