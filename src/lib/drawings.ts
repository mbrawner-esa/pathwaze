// Shared helpers for the Drawings feature.

/**
 * Ensure a drawing_review row exists for a drawing (created once it is linked to
 * an area + discipline). The review uses the action plan attached to the
 * drawing's collection. Returns the review row, or null if the collection has no
 * action plan yet (e.g. a freshly created collection without a checklist).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureReview(supabase: any, drawing: { id: string; collection_id?: string | null; drawing_type?: string }) {
  const { data: existing } = await supabase
    .from('drawing_reviews').select('id, status').eq('drawing_id', drawing.id).maybeSingle()
  if (existing) return existing

  // Resolve the action plan via the drawing's collection.
  let planId: string | null = null
  if (drawing.collection_id) {
    const { data: col } = await supabase
      .from('drawing_collections').select('action_plan_id').eq('id', drawing.collection_id).maybeSingle()
    planId = col?.action_plan_id ?? null
  }
  // Fallback (legacy): resolve by drawing_type if no collection plan.
  if (!planId && drawing.drawing_type) {
    const { data: plan } = await supabase
      .from('action_plans').select('id')
      .eq('drawing_type', drawing.drawing_type).eq('is_active', true)
      .order('version', { ascending: false }).limit(1).maybeSingle()
    planId = plan?.id ?? null
  }
  if (!planId) return null

  const { data } = await supabase
    .from('drawing_reviews')
    .insert({ drawing_id: drawing.id, action_plan_id: planId, status: 'not_started' })
    .select('id, status').single()
  return data
}
