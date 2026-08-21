// Shared bits for Site Plans.
//
// A site plan is a drawing in the collection whose link_target is 'system'
// (seeded as 'Site Plans', migration 052). It is uploaded and linked to systems
// in the Drawings tab; the Technical tab renders it read-only.

import { createClient as createBrowserClient } from '@/lib/supabase/client'

export interface SitePlan {
  id: string
  file_name: string
  set_label: string | null
  storage_path: string | null
  uploaded_at: string
  uploaded_by_name: string | null
  system_ids: string[]
}

/** The current site plan for a system = its most recently uploaded linked plan. */
export function currentSitePlan(plans: SitePlan[], systemId: string): SitePlan | null {
  const mine = plans.filter(p => p.system_ids.includes(systemId))
  if (!mine.length) return null
  return mine.reduce((a, b) => (a.uploaded_at >= b.uploaded_at ? a : b))
}

/** Open a private 'drawings' bucket object in a new tab via a short-lived signed URL. */
export async function openSitePlan(storagePath: string | null) {
  if (!storagePath) return
  const sb = createBrowserClient()
  const { data } = await sb.storage.from('drawings').createSignedUrl(storagePath, 120)
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}
