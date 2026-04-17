import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('stakeholders').insert({
    project_id: body.project_id || null,
    name: body.name,
    title: body.title || null,
    department: body.department || null,
    role: body.role || 'Evaluator',
    email: body.email || null,
    phone: body.phone || null,
    sentiment: body.sentiment || 'Neutral',
    is_primary: body.is_primary || false,
    org: body.org || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
