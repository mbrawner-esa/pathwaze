import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { NextRequest, NextResponse } from 'next/server'

// Attachments on a permit — the application PDF, the stamped approval, a
// correction notice. Binaries are uploaded to the 'project-files' bucket
// client-side (under `permits/<permit_id>/`); this route only records metadata,
// matching how RFI and project-note files work.

// GET /api/permits/[id]/files → list the permit's attachments.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('permit_attachments') as any)
    .select('*, uploader:users!uploaded_by(full_name)')
    .eq('permit_id', id)
    .order('uploaded_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/permits/[id]/files → attach one or more already-uploaded files.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  if (!Array.isArray(body.files) || !body.files.length) {
    return NextResponse.json({ error: 'files required' }, { status: 400 })
  }

  // Confirm the permit exists (and grab context for the activity entry) before
  // writing rows that would otherwise dangle behind a cascade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: permit } = await (supabase.from('permits') as any)
    .select('id, name, project_id').eq('id', id).maybeSingle()
  if (!permit) return NextResponse.json({ error: 'Permit not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = body.files.map((f: any) => ({
    permit_id: id,
    file_name: f.file_name,
    storage_path: f.storage_path ?? null,
    file_size: f.file_size ?? null,
    content_type: f.content_type ?? null,
    doc_type: f.doc_type ?? null,
    uploaded_by: user.id,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('permit_attachments') as any)
    .insert(rows)
    .select('*, uploader:users!uploaded_by(full_name)')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'permit',
    entity_id: id,
    action: 'file_added',
    project_id: permit.project_id,
    metadata: { name: permit.name, count: rows.length, file_name: rows[0]?.file_name ?? null },
  })

  return NextResponse.json(data ?? [])
}
