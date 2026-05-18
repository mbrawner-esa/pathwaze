import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, fileId } = await params

  // Look up the file to get its storage_path (so we can clean up the binary too)
  const { data: file } = await supabase
    .from('task_files')
    .select('storage_path')
    .eq('id', fileId)
    .eq('task_id', id)
    .single() as { data: { storage_path: string | null } | null }

  // Delete the row
  const { error } = await supabase.from('task_files').delete().eq('id', fileId).eq('task_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort: remove the storage object too
  if (file?.storage_path) {
    try {
      await supabase.storage.from('task-files').remove([file.storage_path])
    } catch { /* ignore — row is gone, blob cleanup is not critical */ }
  }

  return NextResponse.json({ success: true })
}
