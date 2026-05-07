import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tasks') as any).insert({
    project_id: body.project_id,
    title: body.title,
    description: body.description || null,
    type: body.type || 'Administrative',
    status: 'Draft',
    priority: body.priority || 'Medium',
    assignee_id: body.assignee_id || null,
    approver_id: body.approver_id || null,
    requires_approval: body.requires_approval || false,
    due_date: body.due_date || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
