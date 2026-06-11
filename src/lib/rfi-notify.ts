// Notification helpers for RFIs, mentions, and Risk escalation.
// All sends are best-effort: failures are logged, never thrown, so they can't
// break the originating request.
import { sendNotificationEmail } from './email'
import { appUrl } from './slack'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

/** Write an activity_log row (powers the in-app notification feed). Best-effort. */
export async function logActivity(supabase: SB, row: { entity_type: string; entity_id: string; action: string; user_id?: string | null; metadata?: Record<string, unknown> }) {
  try {
    await supabase.from('activity_log').insert({
      entity_type: row.entity_type, entity_id: row.entity_id, action: row.action,
      user_id: row.user_id ?? null, metadata: row.metadata ?? {},
    })
  } catch (e) { console.error('[logActivity]', e) }
}

/** Extract mentioned user ids from response/notes HTML (data-uid="…" spans). */
export function parseMentions(html: string): string[] {
  const ids = new Set<string>()
  const re = /data-uid="([0-9a-fA-F-]{8,})"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html || ''))) ids.add(m[1])
  return Array.from(ids)
}

export interface NotifyMsg { subject: string; heading: string; message: string; ctaLabel?: string; ctaUrl?: string }

/** Email a single internal user by id. Best-effort. */
export async function emailUser(supabase: SB, userId: string, msg: NotifyMsg) {
  try {
    const { data: u } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle()
    if (u?.email) await sendNotificationEmail({ to: u.email, recipientName: u.full_name, ...msg })
  } catch (e) { console.error('[emailUser]', e) }
}

/** Email a stakeholder by id (external party). Best-effort. */
export async function emailStakeholder(supabase: SB, stakeholderId: string, msg: NotifyMsg) {
  try {
    const { data: s } = await supabase.from('stakeholders').select('email, name').eq('id', stakeholderId).maybeSingle()
    if (s?.email) await sendNotificationEmail({ to: s.email, recipientName: s.name, ...msg })
  } catch (e) { console.error('[emailStakeholder]', e) }
}

export function rfiUrl(rfiId: string) { return appUrl(`/rfis/${rfiId}`) }
export const rfiNo = (n: number) => '#' + String(n ?? 0).padStart(3, '0')
