import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ENTITY_TYPES = ['project', 'building', 'meter', 'system', 'permit', 'stakeholder'] as const
type EntityType = (typeof ENTITY_TYPES)[number]

// Map entity type → table + label fields to fetch for the link display.
const TABLES: Record<EntityType, { table: string; cols: string }> = {
  project:     { table: 'projects',     cols: 'id, name, project_number' },
  building:    { table: 'buildings',    cols: 'id, name, project_id' },
  meter:       { table: 'meters',       cols: 'id, account_number, building_id' },
  system:      { table: 'systems',      cols: 'id, label, system_kwdc, project_id' },
  permit:      { table: 'permits',      cols: 'id, type, status, project_id' },
  stakeholder: { table: 'stakeholders', cols: 'id, name, role, project_id' },
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: links } = await supabase.from('task_links').select('*').eq('task_id', id).order('created_at') as any
  const list = (links ?? []) as { id: string; entity_type: EntityType; entity_id: string; created_at: string }[]

  // Resolve entity details in parallel, grouped by type to minimize round-trips.
  const byType: Record<EntityType, string[]> = { project: [], building: [], meter: [], system: [], permit: [], stakeholder: [] }
  for (const l of list) if (ENTITY_TYPES.includes(l.entity_type)) byType[l.entity_type].push(l.entity_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolved: Record<string, any> = {}
  await Promise.all(ENTITY_TYPES.map(async type => {
    const ids = byType[type]
    if (!ids.length) return
    const t = TABLES[type]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase.from(t.table).select(t.cols).in('id', ids) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (data ?? []) as any[]) resolved[`${type}:${row.id}`] = row
  }))

  return NextResponse.json(
    list.map(l => ({ ...l, entity: resolved[`${l.entity_type}:${l.entity_id}`] ?? null }))
  )
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const body = await req.json()
  const entity_type = body.entity_type as EntityType
  const entity_id = body.entity_id as string

  if (!ENTITY_TYPES.includes(entity_type)) {
    return NextResponse.json({ error: `Invalid entity_type: ${entity_type}` }, { status: 400 })
  }
  if (!entity_id) return NextResponse.json({ error: 'entity_id required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('task_links') as any)
    .insert({ task_id: id, entity_type, entity_id, created_by: user.id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
