import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'

// Department tags on milestones and tasks.
//
// One route for both, because the operation is identical and the only difference
// is which join table it writes. Splitting it would duplicate the auth, the
// validation and the activity logging for no gain.

type Target = { table: string; idColumn: string; entity: 'milestone' | 'task' }

function resolve(body: { milestone_id?: string; task_id?: string }): Target | null {
  if (body.milestone_id) {
    return {
      table: 'workstream_milestone_departments',
      idColumn: 'milestone_id',
      entity: 'milestone',
    }
  }
  if (body.task_id) {
    return { table: 'task_departments', idColumn: 'task_id', entity: 'task' }
  }
  return null
}

/** POST — tag a department onto a milestone or a task. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    milestone_id?: string; task_id?: string; department_key?: string
  }
  const target = resolve(body)
  if (!target || !body.department_key) {
    return NextResponse.json(
      { error: 'department_key plus one of milestone_id or task_id is required' },
      { status: 400 },
    )
  }

  const rowId = (body.milestone_id ?? body.task_id) as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(target.table) as any).insert({
    [target.idColumn]: rowId,
    department_key: body.department_key,
    created_by: user.id,
  })

  if (error) {
    // Re-tagging the same department is a client mistake, not a server fault.
    const dup = /duplicate key/i.test(error.message)
    return NextResponse.json(
      { error: dup ? 'That department is already tagged' : error.message },
      { status: dup ? 400 : 500 },
    )
  }

  // Log against the milestone so the tag shows in the project's own feed. Task
  // tags are not logged: the tasks module has its own history, and duplicating
  // it here would double-report the same change.
  if (target.entity === 'milestone') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ms } = await (supabase.from('workstream_milestones') as any)
      .select('project_id, label, major_key').eq('id', rowId).single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dept } = await (supabase.from('departments') as any)
      .select('name').eq('key', body.department_key).single()
    if (ms) {
      await logActivity(supabase, user, {
        entity_type: 'workstream_milestone',
        entity_id: rowId,
        action: 'department_tagged',
        project_id: ms.project_id,
        metadata: {
          label: ms.label,
          major_key: ms.major_key,
          department: dept?.name ?? body.department_key,
        },
      })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = request.nextUrl.searchParams
  const target = resolve({
    milestone_id: q.get('milestone_id') ?? undefined,
    task_id: q.get('task_id') ?? undefined,
  })
  const departmentKey = q.get('department_key')
  if (!target || !departmentKey) {
    return NextResponse.json(
      { error: 'department_key plus one of milestone_id or task_id is required' },
      { status: 400 },
    )
  }

  const rowId = (q.get('milestone_id') ?? q.get('task_id')) as string

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from(target.table) as any)
    .delete()
    .eq(target.idColumn, rowId)
    .eq('department_key', departmentKey)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (target.entity === 'milestone') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ms } = await (supabase.from('workstream_milestones') as any)
      .select('project_id, label, major_key').eq('id', rowId).single()
    if (ms) {
      await logActivity(supabase, user, {
        entity_type: 'workstream_milestone',
        entity_id: rowId,
        action: 'department_untagged',
        project_id: ms.project_id,
        metadata: { label: ms.label, major_key: ms.major_key, department: departmentKey },
      })
    }
  }

  return NextResponse.json({ ok: true })
}
