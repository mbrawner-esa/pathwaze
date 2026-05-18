import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, noteId } = await params
  const { data: before } = await supabase.from('project_notes').select('storage_path').eq('id', noteId).eq('project_id', projectId).single() as { data: { storage_path: string | null } | null }

  const { error } = await supabase.from('project_notes').delete().eq('id', noteId).eq('project_id', projectId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (before?.storage_path) {
    try { await supabase.storage.from('project-files').remove([before.storage_path]) } catch { /* ignore */ }
  }
  return NextResponse.json({ success: true })
}
