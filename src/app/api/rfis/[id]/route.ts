import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyRfiParties, logActivity, rfiUrl, rfiNo } from '@/lib/rfi-notify'

// GET /api/rfis/[id] → full detail (with responses + distribution + source finding)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rfi, error } = await (supabase.from('rfis') as any)
    .select('*, project:projects(id, name, project_number), ball_user:users!ball_in_court_user_id(id, full_name), ball_sh:stakeholders!ball_in_court_stakeholder_id(id, name), manager:users!rfi_manager_id(id, full_name), area:buildings(id, name), drawing:drawings(id, file_name)')
    .eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rfi) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: responses } = await (supabase.from('rfi_responses') as any)
    .select('*, author:users!author_id(id, full_name)').eq('rfi_id', id).order('created_at')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: distribution } = await (supabase.from('rfi_distribution') as any)
    .select('*, user:users!user_id(id, full_name), stakeholder:stakeholders!stakeholder_id(id, name)').eq('rfi_id', id)

  return NextResponse.json({ rfi, responses: responses ?? [], distribution: distribution ?? [] })
}

// PATCH /api/rfis/[id] → update fields / status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const patch: Record<string, unknown> = {}
  for (const k of ['subject', 'question', 'status', 'priority', 'ball_in_court_user_id', 'ball_in_court_stakeholder_id',
                    'rfi_manager_id', 'received_from', 'received_from_user_id', 'received_from_stakeholder_id',
                    'due_date', 'drawing_number', 'spec_section', 'location',
                    'cost_impact', 'cost_amount', 'schedule_impact', 'schedule_days', 'is_private'] as const) {
    if (k in body) patch[k] = body[k]
  }
  // Read the current row so we can detect a real status transition (and not
  // double-notify when status is unchanged or already closed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cur } = await (supabase.from('rfis') as any)
    .select('status, date_initiated, rfi_number, subject').eq('id', id).maybeSingle()

  if (body.status === 'closed') patch.closed_at = new Date().toISOString()
  if (body.status === 'open' && body.date_initiated === undefined) {
    // Opening a draft stamps the initiated date if not already set.
    if (cur && !cur.date_initiated) patch.date_initiated = new Date().toISOString().slice(0, 10)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfis') as any).update(patch).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Notifications on status transitions (best-effort, fire-and-forget) ──
  try {
    const becameClosed = body.status === 'closed' && cur?.status !== 'closed'
    const becameOpen   = body.status === 'open'   && cur?.status !== 'open'
    if (becameClosed || becameOpen) {
      const tag = `RFI ${rfiNo(data.rfi_number)}`
      const verb = becameClosed ? 'closed' : 'opened'
      const msg = {
        subject: `${tag} ${verb}`,
        heading: `${tag} ${verb}`,
        message: `<b>${data.subject}</b> was ${verb}.`,
        ctaLabel: 'View RFI', ctaUrl: rfiUrl(id),
      }
      notifyRfiParties(supabase, id, user.id, msg).catch(e => console.error('[rfi PATCH] notify failed:', e))
      logActivity(supabase, { entity_type: 'rfi', entity_id: id, action: `${verb} an RFI`, user_id: user.id, metadata: { rfi_id: id } }).catch(() => {})
    }
  } catch (e) {
    console.warn('[rfi PATCH] status-notify failed:', e)
  }

  return NextResponse.json(data)
}
