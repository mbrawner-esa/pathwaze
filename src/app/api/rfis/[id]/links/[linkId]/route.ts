import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/rfis/[id]/links/[linkId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; linkId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { linkId } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('rfi_links') as any).delete().eq('id', linkId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
