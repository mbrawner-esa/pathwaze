import { createClient } from '@/lib/supabase/server'
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
  }).select('*, author:users!author_id(id, full_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Official response (optionally) closes the RFI and is recorded on the RFI.
  if (body.is_official) {
    const patch: Record<string, unknown> = { official_response_id: resp.id }
    if (body.close) { patch.status = 'closed'; patch.closed_at = new Date().toISOString() }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('rfis') as any).update(patch).eq('id', id)
  }

  return NextResponse.json(resp)
}
