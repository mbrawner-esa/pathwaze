// Shared helpers for the Drawings feature.

/**
 * Ensure a drawing_review row exists for a drawing (created once it is linked to
 * an area + discipline). Returns the review row, or null if no active action plan
 * exists for the drawing's type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureReview(supabase: any, drawing: { id: string; drawing_type: string }) {
  const { data: existing } = await supabase
    .from('drawing_reviews').select('id, status').eq('drawing_id', drawing.id).maybeSingle()
  if (existing) return existing

  const { data: plan } = await supabase
    .from('action_plans').select('id')
    .eq('drawing_type', drawing.drawing_type).eq('is_active', true)
    .order('version', { ascending: false }).limit(1).maybeSingle()
  if (!plan) return null

  const { data } = await supabase
    .from('drawing_reviews')
    .insert({ drawing_id: drawing.id, action_plan_id: plan.id, status: 'not_started' })
    .select('id, status').single()
  return data
}
