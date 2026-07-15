import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/rfi-notify'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/rfis/[id]/files → attach one or more files to the RFI itself.
// Files are uploaded to the 'rfi-files' bucket client-side; metadata passed here.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!Array.isArray(body.files) || !body.files.length) return NextResponse.json({ error: 'files required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = body.files.map((f: any) => ({
    rfi_id: id, file_name: f.file_name, storage_path: f.storage_path ?? null,
    file_size: f.file_size ?? null, content_type: f.content_type ?? null, uploaded_by: user.id,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('rfi_attachments') as any).insert(rows).select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, { entity_type: 'rfi', entity_id: id, action: 'attached a file to an RFI', user_id: user.id, metadata: { rfi_id: id } })
  return NextResponse.json(data ?? [])
}
