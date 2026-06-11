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

/**
 * Email everyone attached to an RFI — ball-in-court (user + stakeholder) and the
 * full distribution list — deduped, skipping the actor. Best-effort. Used for
 * status-change events (e.g. closed) and as the shared fan-out for responses.
 */
export async function notifyRfiParties(supabase: SB, rfiId: string, actorId: string | null, msg: NotifyMsg) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rfi } = await (supabase.from('rfis') as any)
      .select('ball_in_court_user_id, ball_in_court_stakeholder_id').eq('id', rfiId).maybeSingle()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dist } = await (supabase.from('rfi_distribution') as any)
      .select('user_id, stakeholder_id').eq('rfi_id', rfiId)
    const notifiedUsers = new Set<string>(actorId ? [actorId] : [])
    const notifiedStakeholders = new Set<string>()
    if (rfi?.ball_in_court_user_id && !notifiedUsers.has(rfi.ball_in_court_user_id)) {
      notifiedUsers.add(rfi.ball_in_court_user_id); await emailUser(supabase, rfi.ball_in_court_user_id, msg)
    }
    if (rfi?.ball_in_court_stakeholder_id && !notifiedStakeholders.has(rfi.ball_in_court_stakeholder_id)) {
      notifiedStakeholders.add(rfi.ball_in_court_stakeholder_id); await emailStakeholder(supabase, rfi.ball_in_court_stakeholder_id, msg)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of (dist ?? []) as any[]) {
      if (d.user_id && !notifiedUsers.has(d.user_id)) { notifiedUsers.add(d.user_id); await emailUser(supabase, d.user_id, msg) }
      else if (d.stakeholder_id && !notifiedStakeholders.has(d.stakeholder_id)) { notifiedStakeholders.add(d.stakeholder_id); await emailStakeholder(supabase, d.stakeholder_id, msg) }
    }
  } catch (e) { console.error('[notifyRfiParties]', e) }
}
