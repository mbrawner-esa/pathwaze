import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Duplicate a project: copies the projects row + project_financials only.
// Salesforce-style — does NOT copy child entities (tasks, areas, meters,
// systems, permits, stakeholders). New project starts at Prospecting with
// cleared dates.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch the source project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: src, error: srcErr } = await supabase.from('projects').select('*').eq('id', id).single() as any
  if (srcErr || !src) return NextResponse.json({ error: srcErr?.message || 'Project not found' }, { status: 404 })

  // Build copy — strip id, audit fields, dates, stage to Prospecting, name appended " (Copy)"
  const copy: Record<string, unknown> = { ...src }
  delete copy.id
  delete copy.created_at
  delete copy.updated_at
  delete copy.archived_at
  copy.name = `${src.name} (Copy)`
  copy.stage = 'Prospecting'
  copy.start_date = null
  copy.target_cod = null
  copy.permit_submitted = null
  copy.permit_approved = null
  // Clear the duplicate's Slack channel link — should be set fresh
  copy.slack_channel_id = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newProject, error: insertErr } = await (supabase.from('projects') as any)
    .insert(copy)
    .select()
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (insertErr || !newProject) return NextResponse.json({ error: insertErr?.message || 'Insert failed' }, { status: 500 })

  // Duplicate project_financials if any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: srcFin } = await supabase.from('project_financials').select('*').eq('project_id', id).single() as any
  if (srcFin) {
    const finCopy: Record<string, unknown> = { ...srcFin }
    delete finCopy.id
    delete finCopy.created_at
    delete finCopy.updated_at
    finCopy.project_id = newProject.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('project_financials') as any).insert(finCopy)
  }

  return NextResponse.json({ project: newProject })
}
