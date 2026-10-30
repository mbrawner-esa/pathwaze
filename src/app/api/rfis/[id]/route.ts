import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { notifyRfiParties, logActivity, rfiUrl, rfiNo } from '@/lib/rfi-notify'
import { isManagerOrAbove } from '@/lib/permissions'
import { cleanCcIds, setRfiCc, notifyRfiCcAdded } from '@/lib/rfi-cc'

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

// PATCH /api/rfis/[id] → update fields / status / CC list (cc_user_ids replaces the CC'd users)
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
  // Only an actual array counts as a CC update. Without this check a malformed
  // payload (`cc_user_ids: null`, a bare string) would normalise to [] and
  // silently clear the whole CC list.
  if ('cc_user_ids' in body && !Array.isArray(body.cc_user_ids)) {
    return NextResponse.json({ error: 'cc_user_ids must be an array of user ids' }, { status: 400 })
  }
  const ccIds = 'cc_user_ids' in body ? cleanCcIds(body.cc_user_ids) : null
  if (Object.keys(patch).length === 0 && ccIds === null) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = (supabase.from('rfis') as any)
  const { data, error } = Object.keys(patch).length
    ? await q.update(patch).eq('id', id).select('*').single()
    : await q.select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // CC list: sync before the status notifications below so a user added in the
  // same save as a close is mailed once, by the status fan-out.
  let ccAdded: string[] = []
  if (ccIds !== null) {
    try { ccAdded = (await setRfiCc(supabase, id, ccIds)).added }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not update CC list' }, { status: 500 }) }
  }

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
    } else if (ccAdded.length && data.status !== 'draft') {
      // Newly CC'd on a live RFI: tell them (drafts notify everyone when sent).
      notifyRfiCcAdded(supabase, data, ccAdded, user.id).catch(e => console.error('[rfi PATCH] cc notify failed:', e))
    }
  } catch (e) {
    console.warn('[rfi PATCH] status-notify failed:', e)
  }

  return NextResponse.json(data)
}

/**
 * Soft delete (DELETE) and restore (POST) an RFI.
 *
 * The row and its number stay put — migration 076 hides it from team and
 * investor, and admin or manager can bring it back. Responses, attachments and
 * links ride along untouched, which is the point: an RFI with history is often
 * the one someone most wants back.
 */
async function setDeleted(params: Promise<{ id: string }>, deleted: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single() as {
    data: { role?: string } | null
  }
  if (!isManagerOrAbove(me?.role)) {
    return NextResponse.json({ error: 'Only an admin or manager can delete an RFI' }, { status: 403 })
  }

  const { id } = await params
  const patch = deleted
    ? { deleted_at: new Date().toISOString(), deleted_by: user.id }
    : { deleted_at: null, deleted_by: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfis') as any)
    .update(patch).eq('id', id).select('id, rfi_number').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  logActivity(supabase, {
    entity_type: 'rfi', entity_id: id,
    action: deleted ? 'deleted an RFI' : 'restored an RFI',
    user_id: user.id, metadata: { rfi_id: id },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return setDeleted(params, true)
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return setDeleted(params, false)
}
