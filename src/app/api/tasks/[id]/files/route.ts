import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('task_files')
    .select('id, file_name, file_url, storage_path, file_size, content_type, uploaded_at, uploader:users!uploaded_by(full_name)')
    .eq('task_id', id)
    .order('uploaded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { file_name, file_url, storage_path, file_size, content_type } = body
  if (!file_name || typeof file_name !== 'string' || !file_name.trim()) {
    return NextResponse.json({ error: 'file_name is required' }, { status: 400 })
  }
  if (!storage_path && !file_url) {
    return NextResponse.json({ error: 'Either storage_path or file_url is required' }, { status: 400 })
  }

  // Ensure user row exists for FK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('users') as any).upsert({
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: 'team',
  }, { onConflict: 'id', ignoreDuplicates: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('task_files') as any)
    .insert({
      task_id: id,
      file_name: file_name.trim(),
      file_url: (typeof file_url === 'string' && file_url.trim()) ? file_url.trim() : null,
      storage_path: storage_path || null,
      file_size: file_size || null,
      content_type: content_type || null,
      uploaded_by: user.id,
    })
    .select('id, file_name, file_url, storage_path, file_size, content_type, uploaded_at, uploader:users!uploaded_by(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
