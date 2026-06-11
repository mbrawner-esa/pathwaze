// Shared helpers for the RFI module.
import { logActivity, emailUser, emailStakeholder, rfiUrl, rfiNo } from './rfi-notify'

export interface NewRfiInput {
  project_id: string
  subject: string
  question?: string | null
  area_id?: string | null
  drawing_id?: string | null
  ball_in_court_user_id?: string | null
  ball_in_court_stakeholder_id?: string | null
  rfi_manager_id?: string | null
  received_from?: string | null
  received_from_user_id?: string | null
  received_from_stakeholder_id?: string | null
  due_date?: string | null
  drawing_number?: string | null
  spec_section?: string | null
  location?: string | null
  cost_impact?: string
  schedule_impact?: string
  is_private?: boolean
  status?: 'draft' | 'open'
}

/**
 * Create an RFI with the next per-project number. Returns the created row (or null).
 * Defaults: RFI manager = creator, date_initiated = today (when opened).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createRfiFromFinding(supabase: any, userId: string, input: NewRfiInput) {
  // Next per-project number (RPC defined in migration 035).
  const { data: nextNum } = await supabase.rpc('next_rfi_number', { p_project: input.project_id })
  const rfi_number = typeof nextNum === 'number' ? nextNum : 1
  const status = input.status ?? 'open'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfis') as any).insert({
    project_id: input.project_id,
    rfi_number,
    subject: input.subject,
    question: input.question ?? null,
    status,
    area_id: input.area_id ?? null,
    drawing_id: input.drawing_id ?? null,
    ball_in_court_user_id: input.ball_in_court_user_id ?? null,
    ball_in_court_stakeholder_id: input.ball_in_court_stakeholder_id ?? null,
    rfi_manager_id: input.rfi_manager_id ?? userId,
    received_from: input.received_from ?? null,
    received_from_user_id: input.received_from_user_id ?? null,
    received_from_stakeholder_id: input.received_from_stakeholder_id ?? null,
    due_date: input.due_date ?? null,
    date_initiated: status === 'open' ? new Date().toISOString().slice(0, 10) : null,
    drawing_number: input.drawing_number ?? null,
    spec_section: input.spec_section ?? null,
    location: input.location ?? null,
    cost_impact: input.cost_impact ?? 'tbd',
    schedule_impact: input.schedule_impact ?? 'tbd',
    is_private: input.is_private ?? false,
    created_by: userId,
  }).select('*').single()

  if (error) { console.error('[createRfi] insert failed:', error.message); return null }

  // Notify (best-effort): log to the feed; email the ball-in-court if the RFI is open.
  const tag = `RFI ${rfiNo(data.rfi_number)}`
  await logActivity(supabase, { entity_type: 'rfi', entity_id: data.id, action: status === 'open' ? 'opened an RFI' : 'drafted an RFI', user_id: userId, metadata: { rfi_id: data.id } })
  if (status === 'open') {
    const msg = { subject: `${tag} needs your input`, heading: `${tag} assigned to you`, message: `<b>${data.subject}</b>`, ctaLabel: 'Open RFI', ctaUrl: rfiUrl(data.id) }
    if (data.ball_in_court_user_id) await emailUser(supabase, data.ball_in_court_user_id, msg)
    else if (data.ball_in_court_stakeholder_id) await emailStakeholder(supabase, data.ball_in_court_stakeholder_id, msg)
  }
  return data
}
