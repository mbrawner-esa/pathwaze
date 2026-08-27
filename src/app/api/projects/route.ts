import { createClient } from '@/lib/supabase/server'
import { DEFAULT_STAGE } from '@/lib/stages'
import { NextRequest, NextResponse } from 'next/server'

// DEFAULT_MILESTONES lived here and seeded 12 rows into `milestones` on every
// project create. Those labels now live in the workstream_milestones catalog
// (migration 054) and are shared by every project, so there is nothing to seed.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Create the project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error: projErr } = await (supabase.from('projects') as any).insert({
    project_number: body.project_number || `NEW-${Date.now()}`,
    name: body.name,
    customer: body.customer || 'AdventHealth',
    stage: body.stage || DEFAULT_STAGE,
    deal_health: body.deal_health || 'TBD',
    system_kwdc: body.system_kwdc || 0,
    system_kwac: body.system_kwac || 0,
    // NOT NULL text columns — must use '' (sending null overrides the DB default and fails)
    address: body.address || '',
    city: body.city || '',
    state: body.state || '',
    zip: body.zip || '',
    utility: body.utility || '',
    rate_schedule: body.rate_schedule || '',
    // Nullable columns
    lat: body.lat || null,
    lng: body.lng || null,
    tranche: body.tranche || null,
    assignee_id: body.assignee_id || null,
    facility_type: body.facility_type || '',
    region: body.region || null,
    target_cod: body.target_cod || null,
  }).select().single()

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 })

  // No major-milestone seeding: majors are catalog rows shared by every project,
  // so a new project already has its full set the moment it exists. Milestones
  // are the part a PM fills in.
  //
  // Stage gates and objectives DO need seeding, because they are per-project and
  // editable — each project gets its own copy of the starting set. Migration 055
  // backfills existing projects; this covers new ones.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gateTemplates } = await (supabase.from('workstream_gate_templates') as any)
    .select('major_key, kind, label, sort_order')
  if (gateTemplates?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('workstream_gates') as any).insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gateTemplates as any[]).map(t => ({ ...t, project_id: project.id })),
    )
  }

  // Default major-milestone owners, matching migration 061: Technical and
  // Approvals go to the project's assigned PM, Commercial to Morgan Brawner.
  // Seeded here so a new project is owned from the moment it exists rather than
  // waiting for someone to notice every major is unowned.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allMajors } = await (supabase.from('workstream_majors') as any)
    .select('key, workstream')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: commercialOwner } = await (supabase.from('users') as any)
    .select('id').eq('email', 'mbrawner@esa-solar.com').maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerRows = ((allMajors ?? []) as any[]).map(m => ({
    project_id: project.id,
    major_key: m.key,
    owner_id: m.workstream === 'commercial'
      ? (commercialOwner?.id ?? null)
      : (project.assignee_id ?? null),
  })).filter(r => r.owner_id)

  if (ownerRows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('workstream_major_state') as any)
      .upsert(ownerRows, { onConflict: 'project_id,major_key' })
  }

  // Milestones are seeded the same way, so a new project opens with the standard
  // plan (labels, descriptions and weights) rather than an empty spine. Every
  // seeded row is fully editable per project.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msTemplates } = await (supabase.from('workstream_milestone_templates') as any)
    .select('major_key, label, description, stage_gate, weight_pct, is_critical, sort_order')
  if (msTemplates?.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('workstream_milestones') as any).insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (msTemplates as any[]).map(t => ({ ...t, project_id: project.id })),
    )
  }

  // Create empty financials row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('project_financials') as any).insert({
    project_id: project.id,
    total_cost: 0,
  })

  return NextResponse.json(project)
}
