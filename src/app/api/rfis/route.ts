import { createClient } from '@/lib/supabase/server'
import { createRfiFromFinding } from '@/lib/rfis'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/rfis  → portfolio list (optionally ?project_id=, ?status=)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('rfis') as any)
    .select('*, project:projects(id, name, project_number), ball_user:users!ball_in_court_user_id(id, full_name), ball_sh:stakeholders!ball_in_court_stakeholder_id(id, name), manager:users!rfi_manager_id(id, full_name)')
    .order('created_at', { ascending: false })

  const projectId = req.nextUrl.searchParams.get('project_id')
  const status = req.nextUrl.searchParams.get('status')
  if (projectId) q = q.eq('project_id', projectId)
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/rfis  → create a standalone RFI
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.project_id || !body.subject?.trim()) {
    return NextResponse.json({ error: 'project_id and subject required' }, { status: 400 })
  }
  const rfi = await createRfiFromFinding(supabase, user.id, { ...body, subject: body.subject.trim() })
  if (!rfi) return NextResponse.json({ error: 'Failed to create RFI' }, { status: 500 })
  return NextResponse.json(rfi)
}
