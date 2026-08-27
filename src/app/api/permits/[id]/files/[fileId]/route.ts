import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/permits/[id]/files/[fileId] → remove a permit attachment
// (metadata row + the stored object).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, fileId } = await params

  // Drop the object first, then the row. The reverse order can orphan the file
  // in storage if the delete fails — this way a failed object removal leaves a
  // row we can still see and retry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase.from('permit_attachments') as any)
    .select('storage_path').eq('id', fileId).eq('permit_id', id).maybeSingle()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (row.storage_path) await supabase.storage.from('project-files').remove([row.storage_path])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('permit_attachments') as any)
    .delete().eq('id', fileId).eq('permit_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
