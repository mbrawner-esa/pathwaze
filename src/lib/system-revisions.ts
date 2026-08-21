// Shared helper for bumping a system's design revision.
//
// systems.design_rev is an auto-incrementing revision that doubles as a "design
// last modified" marker — it is never typed by a user. It advances only when a
// design-defining field actually changes value, so a status change or a typo fix
// in the name does not read as a new design revision.
//
// Two call sites bump: PATCH /api/systems/[id] (a field edit) and the drawings
// routes (a site plan revision newly linked to systems).

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { logActivity } from './activity'

/**
 * Fields whose value defines the design. A change to any of these bumps the rev.
 * Deliberately excludes `name`, `design_status`, and `meter_id` — those describe
 * the system's bookkeeping, not its design.
 */
export const DESIGN_FIELDS = [
  'size_kwdc',
  'size_kwac',
  'yield_kwh_kwp',
  'system_type',
  'num_modules',
  'module_wattage',
  'num_inverters',
  'inverter_rating',
  'design_url',
] as const

/** Human labels for the activity-log metadata (so the feed reads plainly). */
const FIELD_LABELS: Record<string, string> = {
  size_kwdc: 'Size kWdc',
  size_kwac: 'Size kWac',
  yield_kwh_kwp: 'Yield',
  system_type: 'System type',
  num_modules: 'Module count',
  module_wattage: 'Module wattage',
  num_inverters: 'Inverter count',
  inverter_rating: 'Inverter rating',
  design_url: 'Design link',
  building_ids: 'Linked areas',
  site_plan: 'Site plan',
}

export const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f

/**
 * Compare a patch against the current row and return the design-defining fields
 * whose value actually changed. Numeric fields are compared numerically so that
 * "500" vs 500 is not treated as an edit; nullish is normalised so '' vs null is
 * not either.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function changedDesignFields(before: Record<string, any>, patch: Record<string, any>): string[] {
  const changed: string[] = []
  for (const f of DESIGN_FIELDS) {
    if (!(f in patch)) continue
    const a = before?.[f]
    const b = patch[f]
    if (a === null || a === undefined || a === '') {
      if (b !== null && b !== undefined && b !== '') changed.push(f)
      continue
    }
    if (b === null || b === undefined || b === '') { changed.push(f); continue }
    // Numeric-ish comparison when both sides parse as numbers.
    const na = Number(a), nb = Number(b)
    if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') {
      if (na !== nb) changed.push(f)
    } else if (String(a) !== String(b)) {
      changed.push(f)
    }
  }
  return changed
}

/** True when the two area-link sets differ (order-insensitive). */
export function areaLinksChanged(before: string[], after: string[]): boolean {
  const a = Array.from(new Set(before)).sort().join(',')
  const b = Array.from(new Set(after)).sort().join(',')
  return a !== b
}

/**
 * Bump design_rev on the given systems and log the revision to the activity feed.
 * Reads each row first because PostgREST has no atomic column increment; the race
 * window here is a two-people-editing-the-same-system case that ends with the same
 * displayed date, so it is not worth an RPC.
 *
 * `reason` names what moved (field labels, or 'Site plan') for the feed entry.
 */
export async function bumpSystemRevs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  user: User,
  systemIds: string[],
  reason: string[],
) {
  const ids = Array.from(new Set(systemIds.filter(Boolean)))
  if (!ids.length) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase.from('systems') as any)
    .select('id, name, project_id, design_rev').in('id', ids)

  const now = new Date().toISOString()
  for (const row of (rows ?? []) as { id: string; name: string; project_id: string; design_rev: number | null }[]) {
    const next = (row.design_rev ?? 1) + 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('systems') as any)
      .update({ design_rev: next, design_rev_at: now, design_rev_by: user.id })
      .eq('id', row.id)

    await logActivity(supabase, user, {
      entity_type: 'system',
      entity_id: row.id,
      action: 'revised',
      project_id: row.project_id,
      metadata: { name: row.name, design_rev: next, changed: reason },
    })
  }
}
