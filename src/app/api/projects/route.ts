import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_MILESTONES = [
  'Site Assessment Complete',
  'Feasibility Report Delivered',
  'PPA / Contract Executed',
  'Interconnection Application Filed',
  'Engineering Design Approved',
  'Permit Submitted',
  'Permit Approved',
  'Equipment Procurement',
  'Construction Start',
  'Substantial Completion',
  'Interconnection Approved',
  'PTO / Commercial Operation',
]

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
    stage: body.stage || 'Prospecting',
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

  // Create default milestones
  const milestones = DEFAULT_MILESTONES.map((label, i) => ({
    project_id: project.id,
    label,
    sort_order: i + 1,
    completed: false,
    target_date: null,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('milestones') as any).insert(milestones)

  // Create empty financials row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('project_financials') as any).insert({
    project_id: project.id,
    total_cost: 0,
  })

  return NextResponse.json(project)
}
