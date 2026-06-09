import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
                    'rfi_manager_id', 'received_from', 'due_date', 'drawing_number', 'spec_section', 'location',
                    'cost_impact', 'cost_amount', 'schedule_impact', 'schedule_days', 'is_private'] as const) {
    if (k in body) patch[k] = body[k]
  }
  if (body.status === 'closed') patch.closed_at = new Date().toISOString()
  if (body.status === 'open' && body.date_initiated === undefined) {
    // Opening a draft stamps the initiated date if not already set.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cur } = await (supabase.from('rfis') as any).select('date_initiated').eq('id', id).maybeSingle()
    if (cur && !cur.date_initiated) patch.date_initiated = new Date().toISOString().slice(0, 10)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfis') as any).update(patch).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
