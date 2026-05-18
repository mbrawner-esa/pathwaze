import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns a short-lived signed URL the browser can use to download
// the binary from Supabase Storage. Bucket is private; this is the
// supported way to expose a download link to the client.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, fileId } = await params

  const { data: file, error } = await supabase
    .from('task_files')
    .select('storage_path, file_name')
    .eq('id', fileId)
    .eq('task_id', id)
    .single() as { data: { storage_path: string | null; file_name: string } | null; error: { message: string } | null }

  if (error || !file?.storage_path) {
    return NextResponse.json({ error: 'File not found or has no storage path' }, { status: 404 })
  }

  const { data: signed, error: sErr } = await supabase
    .storage
    .from('task-files')
    .createSignedUrl(file.storage_path, 60 * 10) // 10 minutes

  if (sErr || !signed?.signedUrl) {
    return NextResponse.json({ error: sErr?.message || 'Failed to sign URL' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl, file_name: file.file_name })
}
