import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isManagerOrAbove } from '@/lib/permissions'

/**
 * Soft delete (DELETE) and restore (POST) a project note.
 *
 * Nothing is removed: migration 076 hides a note with deleted_at set from
 * everyone except admin and manager, who can restore it. The attached file in
 * project-files is deliberately left in place — removing it would make a
 * restored note point at nothing.
 */
async function roleOf(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('users').select('role').eq('id', userId).single() as {
    data: { role?: string } | null
  }
  return data?.role ?? 'team'
}

async function setDeleted(
  req: NextRequest,
  params: Promise<{ id: string; noteId: string }>,
  deleted: boolean
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isManagerOrAbove(await roleOf(supabase, user.id))) {
    return NextResponse.json({ error: 'Only an admin or manager can delete a note' }, { status: 403 })
  }

  const { id: projectId, noteId } = await params
  const patch = deleted
    ? { deleted_at: new Date().toISOString(), deleted_by: user.id }
    : { deleted_at: null, deleted_by: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('project_notes') as any)
    .update(patch).eq('id', noteId).eq('project_id', projectId).select('id').maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  return setDeleted(req, params, true)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  return setDeleted(req, params, false)
}
