import { createClient } from '@/lib/supabase/server'
import { ensureReview } from '@/lib/drawings'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/drawings?project_id=...  → list drawings (with area + review) for a project
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = req.nextUrl.searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawings') as any)
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status, reviewer_id, due_date)')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/drawings  → create a drawing metadata row (file already uploaded to storage)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { project_id, file_name, storage_path, file_url, file_size, content_type, set_label,
          drawing_type, area_id, discipline_key, collection_id } = body
  if (!project_id || !file_name) {
    return NextResponse.json({ error: 'project_id and file_name required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drawings') as any)
    .insert({
      project_id,
      file_name,
      storage_path: storage_path ?? null,
      file_url: file_url ?? null,
      file_size: file_size ?? null,
      content_type: content_type ?? null,
      set_label: set_label ?? null,
      drawing_type: drawing_type ?? 'as_built',
      collection_id: collection_id ?? null,
      area_id: area_id ?? null,
      discipline_key: discipline_key ?? null,
      uploaded_by: user.id,
    })
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If it was created already linked, ensure a review exists.
  if (data?.area_id && data?.discipline_key) await ensureReview(supabase, data)

  return NextResponse.json(data)
}
