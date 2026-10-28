import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNote } from '@/lib/notes'

// POST a note / event / file metadata for the project.
// File-type entries assume the binary is already uploaded to the
// project-files Storage bucket; we just record metadata here.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId } = await params
  const body = await request.json()

  try {
    // Insert + activity + mention notifications live in src/lib/notes.ts so this
    // route and the MCP server create notes the same way.
    const note = await createNote(supabase, user, { ...body, project_id: projectId })
    return NextResponse.json({ note })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create note' }, { status: 500 })
  }
}
