import { createClient } from '@/lib/supabase/server'
import { logActivity, parseMentions, emailUser, emailStakeholder, rfiUrl, rfiNo } from '@/lib/rfi-notify'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/rfis/[id]/responses → add a response; { body, is_official?, close? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: resp, error } = await (supabase.from('rfi_responses') as any).insert({
    rfi_id: id,
    author_id: user.id,
    body: body.body.trim(),
    is_official: !!body.is_official,
    via: 'app',
  }).select('*, author:users!author_id(id, full_name, avatar_url)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attachments (uploaded to storage client-side; metadata passed here).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let files: any[] = []
  if (Array.isArray(body.files) && body.files.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = body.files.map((f: any) => ({
      response_id: resp.id, rfi_id: id, file_name: f.file_name, storage_path: f.storage_path ?? null,
      file_size: f.file_size ?? null, content_type: f.content_type ?? null, uploaded_by: user.id,
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted } = await (supabase.from('rfi_response_files') as any).insert(rows).select('*')
    files = inserted ?? []
  }

  // Official response (optionally) closes the RFI and is recorded on the RFI.
  if (body.is_official) {
    const patch: Record<string, unknown> = { official_response_id: resp.id }
    if (body.close) { patch.status = 'closed'; patch.closed_at = new Date().toISOString() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('rfis') as any).update(patch).eq('id', id)
  }

  // ── Notifications (best-effort) ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rfi } = await (supabase.from('rfis') as any)
    .select('rfi_number, subject, ball_in_court_user_id, ball_in_court_stakeholder_id').eq('id', id).maybeSingle()
  if (rfi) {
    const tag = `RFI ${rfiNo(rfi.rfi_number)}`
    const url = rfiUrl(id)
    const notified = new Set<string>([user.id])

    // @-mentions → in-app + email
    const mentioned = parseMentions(body.body).filter(uid => !notified.has(uid))
    for (const uid of mentioned) {
      notified.add(uid)
      await logActivity(supabase, { entity_type: 'rfi', entity_id: id, action: 'mentioned you in an RFI', user_id: user.id, metadata: { rfi_id: id } })
      await emailUser(supabase, uid, { subject: `You were mentioned on ${tag}`, heading: `You were mentioned on ${tag}`, message: `You were mentioned in a response on <b>${rfi.subject}</b>.`, ctaLabel: 'Open RFI', ctaUrl: url })
    }

    // Response → notify ball-in-court + distribution. Wording reflects whether
    // this is an official response and/or closed the RFI (the official+close
    // path updates status directly here, bypassing the PATCH-route close
    // notification — so the closed notice has to come from here).
    const official = !!body.is_official
    const closed = official && !!body.close
    const label = closed ? 'Official response posted & RFI closed'
                : official ? 'Official response posted'
                : 'New response'
    const detail = closed ? `An official response was posted and ${tag} was closed`
                 : official ? `An official response was posted`
                 : `A new response was posted`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dist } = await (supabase.from('rfi_distribution') as any).select('user_id, stakeholder_id, contact_email').eq('rfi_id', id)
    const msg = { subject: `${label} — ${tag}`, heading: `${label} on ${tag}`, message: `${detail} on <b>${rfi.subject}</b>.`, ctaLabel: 'View RFI', ctaUrl: url }
    if (rfi.ball_in_court_user_id && !notified.has(rfi.ball_in_court_user_id)) { notified.add(rfi.ball_in_court_user_id); await emailUser(supabase, rfi.ball_in_court_user_id, msg) }
    if (rfi.ball_in_court_stakeholder_id) await emailStakeholder(supabase, rfi.ball_in_court_stakeholder_id, msg)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const d of (dist ?? []) as any[]) {
      if (d.user_id && !notified.has(d.user_id)) { notified.add(d.user_id); await emailUser(supabase, d.user_id, msg) }
      else if (d.stakeholder_id) await emailStakeholder(supabase, d.stakeholder_id, msg)
    }
    await logActivity(supabase, { entity_type: 'rfi', entity_id: id, action: closed ? 'closed an RFI with an official response' : official ? 'posted an official response' : 'responded to an RFI', user_id: user.id, metadata: { rfi_id: id } })
  }

  return NextResponse.json({ ...resp, files })
}
