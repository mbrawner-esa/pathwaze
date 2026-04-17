import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const projectId = formData.get('projectId') as string
  const categoryId = formData.get('categoryId') as string
  const docName = formData.get('docName') as string

  // TODO: Upload to Box using Box SDK
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('dataroom_docs') as any).update({
    status: 'uploaded',
    file_name: file.name,
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),
  }).eq('project_id', projectId).eq('category_id', categoryId).eq('doc_name', docName)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
