// CC list for RFIs.
//
// A CC is a *user* row in `rfi_distribution` (the table has existed since
// migration 035 and is already fanned out to by `notifyRfiParties` and the
// response route on close / response / reopen). This module is the missing
// write path: set the CC list at creation or later, and tell people who were
// just added. Stakeholder rows in the same table are external parties managed
// elsewhere and are never touched here.
import { emailUser, rfiUrl, rfiNo } from './rfi-notify'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any

/** Normalise an untrusted payload to a de-duplicated list of user-id strings. */
export function cleanCcIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.filter((v): v is string => typeof v === 'string' && v.length > 0)))
}

/**
 * Make the set of CC'd *users* on an RFI equal `userIds`: insert the missing,
 * delete the removed. Returns the ids that were newly added (so the caller can
 * notify them). Throws on a database error so the request can report it.
 */
export async function setRfiCc(supabase: SB, rfiId: string, userIds: string[]): Promise<{ added: string[]; removed: string[] }> {
  const want = new Set(userIds)
  const { data: rows, error } = await (supabase.from('rfi_distribution') as SB)
    .select('id, user_id').eq('rfi_id', rfiId).not('user_id', 'is', null)
  if (error) throw new Error(error.message)

  const have = new Map<string, string[]>()   // user_id -> row ids (usually one)
  for (const r of (rows ?? []) as { id: string; user_id: string }[]) {
    have.set(r.user_id, [...(have.get(r.user_id) ?? []), r.id])
  }

  const added = userIds.filter(u => !have.has(u))
  // Remove users no longer wanted, and any duplicate rows for users who stay.
  const dropRowIds: string[] = []
  const removed: string[] = []
  have.forEach((ids, uid) => {
    if (!want.has(uid)) { removed.push(uid); dropRowIds.push(...ids) }
    else dropRowIds.push(...ids.slice(1))
  })

  if (dropRowIds.length) {
    const { error: delErr } = await (supabase.from('rfi_distribution') as SB).delete().in('id', dropRowIds)
    if (delErr) throw new Error(delErr.message)
  }
  if (added.length) {
    const { error: insErr } = await (supabase.from('rfi_distribution') as SB)
      .insert(added.map(user_id => ({ rfi_id: rfiId, user_id })))
    if (insErr) throw new Error(insErr.message)
  }
  return { added, removed }
}

/**
 * Tell newly CC'd users they were copied, using the same email path as the
 * ball-in-court notice. The actor is skipped (no point mailing yourself).
 * Best-effort: never throws.
 */
export async function notifyRfiCcAdded(
  supabase: SB, rfi: { id: string; rfi_number: number; subject: string; status?: string }, userIds: string[], actorId: string | null,
) {
  const tag = `RFI ${rfiNo(rfi.rfi_number)}`
  const msg = {
    subject: `You were CC'd on ${tag}`,
    heading: `You were CC'd on ${tag}`,
    message: `You were copied on <b>${rfi.subject}</b> for visibility.${rfi.status === 'closed' ? '' : ' You will be notified when it is closed.'}`,
    ctaLabel: 'View RFI', ctaUrl: rfiUrl(rfi.id),
  }
  for (const uid of userIds) {
    if (uid === actorId) continue
    await emailUser(supabase, uid, msg)
  }
}
