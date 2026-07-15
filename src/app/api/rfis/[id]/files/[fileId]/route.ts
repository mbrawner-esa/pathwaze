import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/rfis/[id]/files/[fileId] → remove an RFI attachment (row + object).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, fileId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase.from('rfi_attachments') as any)
    .select('storage_path').eq('id', fileId).eq('rfi_id', id).maybeSingle()
  if (row?.storage_path) await supabase.storage.from('rfi-files').remove([row.storage_path])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('rfi_attachments') as any).delete().eq('id', fileId).eq('rfi_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
