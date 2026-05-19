import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Create a new milestone for a project. Used by the Schedule tab "+ Add"
// when a user wants to track something beyond the standard 19.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.project_id || !body.label) {
    return NextResponse.json({ error: 'project_id and label are required' }, { status: 400 })
  }

  // Compute next sort_order = max(existing) + 1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await supabase
    .from('milestones')
    .select('sort_order')
    .eq('project_id', body.project_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { sort_order?: number } | null }
  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('milestones') as any)
    .insert({
      project_id: body.project_id,
      label: body.label,
      target_date: body.target_date || null,
      status: body.status || 'Not Started',
      notes: body.notes || null,
      completed: false,
      sort_order: body.sort_order ?? nextOrder,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ milestone: data })
}
