import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity'
import { isAdmin, type Role } from '@/lib/permissions'

// Fields a client may set. sort_order has its own batch endpoint, and moving a
// milestone between projects or majors is not a supported operation.
// `label` is deliberately absent: milestone NAMES are fixed. Every project
// carries the same seeded wording and Reports compare milestones across the
// portfolio by it, so a rename anywhere quietly breaks the comparison
// everywhere. Renaming is a template change, which means a migration.
// Descriptions are editable but admin-only; everything else is open.
const WRITABLE = [
  'description', 'stage_gate', 'weight_pct', 'is_critical',
  'end_date', 'baseline_date', 'status', 'notes', 'risk',
] as const

// Field changes worth an activity entry. Rich-text fields are excluded — they
// save on every edit and would drown the feed.
const LOGGED: Record<string, string> = {
  stage_gate: 'stage gate',
  weight_pct: 'weight',
  is_critical: 'critical path',
  end_date: 'target date',
  baseline_date: 'baseline date',
  status: 'status',
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const update: Record<string, unknown> = {}
  for (const f of WRITABLE) if (body[f] !== undefined) update[f] = body[f]
  if (!Object.keys(update).length) {
    return NextResponse.json({ error: 'No writable fields supplied' }, { status: 400 })
  }

  if (update.weight_pct !== undefined) {
    const w = Number(update.weight_pct)
    if (Number.isNaN(w) || w < 0 || w > 100) {
      return NextResponse.json({ error: 'Weight must be between 0 and 100' }, { status: 400 })
    }
    update.weight_pct = w
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('workstream_milestones') as any)
    .select('*').eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Descriptions are admin-only. Dates, status, weight and the critical-path
  // flag stay open to everyone — those are the fields a PM works day to day.
  const rewriting = update.description !== undefined && update.description !== before.description
  if (rewriting) {
    const { data: me } = await supabase
      .from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
    if (!isAdmin(me?.role as Role)) {
      return NextResponse.json(
        { error: 'Only an admin can change a milestone description.' },
        { status: 403 },
      )
    }
  }

  // completed_at is server-owned so it always matches the status transition,
  // including when a milestone is re-opened after being completed.
  if (update.status !== undefined && update.status !== before.status) {
    update.completed_at = update.status === 'complete' ? new Date().toISOString() : null
  }

  // ── baseline: auto-capture once, then admin-locked ──
  // The first target ever set becomes the baseline, so the original commitment
  // is recorded without anyone having to think about it. After that the target
  // moves freely and the gap between them is the slip — which is the whole
  // point, so a non-admin must not be able to quietly re-baseline it away.
  if (update.baseline_date !== undefined && before.baseline_date) {
    const { data: me } = await supabase
      .from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
    if (!isAdmin(me?.role as Role)) {
      return NextResponse.json(
        { error: 'The baseline is locked. Only an admin can change it once set.' },
        { status: 403 },
      )
    }
  }
  if (update.end_date && !before.baseline_date && update.baseline_date === undefined) {
    update.baseline_date = update.end_date
  }

  update.updated_at = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('workstream_milestones') as any)
    .update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // One entry per changed field, so the feed reads as a history of decisions
  // rather than "a milestone was edited".
  for (const [field, label] of Object.entries(LOGGED)) {
    if (update[field] === undefined || update[field] === before[field]) continue
    await logActivity(supabase, user, {
      entity_type: 'workstream_milestone',
      entity_id: id,
      action: 'field_changed',
      project_id: before.project_id,
      metadata: {
        field, field_label: label,
        from: before[field], to: update[field],
        label: data.label,
        major_key: before.major_key,
      },
    })
  }

  // `risk` is rich text and so is excluded from LOGGED above — it saves on every
  // edit and the body would drown the feed. But a risk being RAISED or CLEARED
  // is exactly the signal the pipeline-health feed exists for, and that is a
  // transition, not a body change: it fires twice in a milestone's life, not on
  // every keystroke-pause. So log presence, never content.
  if (update.risk !== undefined) {
    const had = hasContent(before.risk)
    const has = hasContent(update.risk as string | null)
    if (had !== has) {
      await logActivity(supabase, user, {
        entity_type: 'workstream_milestone',
        entity_id: id,
        action: 'field_changed',
        project_id: before.project_id,
        metadata: {
          field: 'risk', field_label: 'risk',
          // Booleans, deliberately: the log records that a risk exists, not what
          // it says. Reading the risk itself means opening the milestone.
          from: had, to: has,
          label: data.label,
          major_key: before.major_key,
        },
      })
    }
  }

  return NextResponse.json(data)
}

/**
 * Does a rich-text field actually say anything?
 *
 * RichTextEditor leaves an empty field as `<p></p>` or `<p><br></p>` rather than
 * an empty string, so a plain truthiness check would read a cleared risk as one
 * that is still raised.
 */
function hasContent(html: string | null | undefined): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: before } = await (supabase.from('workstream_milestones') as any)
    .select('project_id, label, major_key').eq('id', id).single()
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Linked tasks are NOT deleted — they are real work that may already be under
  // way. The FK is ON DELETE SET NULL, so they simply become unlinked tasks and
  // stay visible in /tasks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from('tasks') as any)
    .select('id', { count: 'exact', head: true })
    .eq('workstream_milestone_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('workstream_milestones') as any).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity(supabase, user, {
    entity_type: 'workstream_milestone',
    entity_id: id,
    action: 'milestone_deleted',
    project_id: before.project_id,
    metadata: { label: before.label, major_key: before.major_key, unlinked_tasks: count ?? 0 },
  })

  return NextResponse.json({ ok: true, unlinked_tasks: count ?? 0 })
}
