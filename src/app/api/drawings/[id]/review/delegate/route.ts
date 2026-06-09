import { createClient } from '@/lib/supabase/server'
import { sendTaskAssignedEmail } from '@/lib/email'
import { logActivity } from '@/lib/rfi-notify'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/drawings/[id]/review/delegate
// Create an engineer task from a finding and attach it (review_findings.delegated_task_id).
// body: { item_id, assignee_id?, title?, description?, due_date? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  if (!body.item_id) return NextResponse.json({ error: 'item_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawing } = await (supabase.from('drawings') as any)
    .select('id, project_id, area_id, file_name').eq('id', id).maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: review } = await (supabase.from('drawing_reviews') as any)
    .select('id').eq('drawing_id', id).maybeSingle()
  if (!drawing || !review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from('action_plan_items') as any)
    .select('prompt').eq('id', body.item_id).maybeSingle()

  const title = (body.title?.trim()) || `Field verify: ${item?.prompt ?? 'drawing finding'}`
  const description = body.description
    ?? `From drawing review: ${drawing.file_name}\n${item?.prompt ?? ''}`

  // 1) Create the task
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: task, error: taskErr } = await (supabase.from('tasks') as any).insert({
    project_id: drawing.project_id,
    title,
    description,
    type: 'Engineering',
    status: 'Ready to Start',
    priority: 'Medium',
    assignee_id: body.assignee_id || null,
    due_date: body.due_date || null,
    visibility: 'public',
    created_by: user.id,
  }).select().single()
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 })

  // 2) Link the task to the building (area), so it shows on the project record
  if (drawing.area_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('task_links') as any)
      .insert({ task_id: task.id, entity_type: 'building', entity_id: drawing.area_id, created_by: user.id })
  }

  // 3) Ensure a finding row exists for this item and stamp the task id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('review_findings') as any)
    .select('id').eq('drawing_review_id', review.id).eq('action_plan_item_id', body.item_id).maybeSingle()
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('review_findings') as any).update({ delegated_task_id: task.id }).eq('id', existing.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('review_findings') as any).insert({
      drawing_review_id: review.id, action_plan_item_id: body.item_id,
      delegated_task_id: task.id, created_by: user.id,
    })
  }

  // Notify the assignee (best-effort) + log to the feed.
  if (task.assignee_id && task.assignee_id !== user.id) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: a }, { data: actor }, { data: proj }] = await Promise.all([
        (supabase.from('users') as any).select('email, full_name, notify_email_task_assigned').eq('id', task.assignee_id).maybeSingle(),
        (supabase.from('users') as any).select('full_name, email').eq('id', user.id).maybeSingle(),
        (supabase.from('projects') as any).select('name').eq('id', drawing.project_id).maybeSingle(),
      ]) as any
      if (a?.email && a.notify_email_task_assigned !== false) {
        const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://pathwaze.esa-solar.com'
        await sendTaskAssignedEmail({
          to: a.email, recipientName: a.full_name || a.email, taskTitle: task.title, taskDescription: description,
          projectName: proj?.name ?? null, dueDate: task.due_date, priority: task.priority, type: 'Engineering',
          assignerName: actor?.full_name || 'A teammate', taskUrl: `${origin}/tasks?id=${task.id}`,
        })
      }
    } catch (e) { console.error('[delegate notify]', e) }
  }
  await logActivity(supabase, { entity_type: 'task', entity_id: task.id, action: 'delegated a task from a drawing review', user_id: user.id, metadata: { project_id: drawing.project_id } })

  return NextResponse.json({ task: { id: task.id, title: task.title, status: task.status, assignee_id: task.assignee_id } })
}
