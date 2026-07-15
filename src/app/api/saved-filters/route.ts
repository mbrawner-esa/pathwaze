import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const SCOPES = ['projects', 'tasks'] as const

// GET /api/saved-filters?scope=projects|tasks → the current user's presets.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = new URL(req.url).searchParams.get('scope')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase.from('saved_filters') as any).select('*').eq('user_id', user.id).order('name')
  if (scope) q = q.eq('scope', scope)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/saved-filters  { scope, name, filters } → create a preset.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const scope = body.scope
  if (!SCOPES.includes(scope)) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('saved_filters') as any)
    .insert({ user_id: user.id, scope, name: body.name.trim(), filters: body.filters ?? {} })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
