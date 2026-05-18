import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Whitelist of fields a user can edit on their own row via this endpoint.
const ALLOWED_FIELDS = [
  'notify_slack_task_assigned',
  'notify_slack_task_status',
  'notify_slack_task_threads',
] as const

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const update: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) if (body[key] !== undefined) update[key] = body[key]
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No valid fields' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('users') as any).update(update).eq('id', user.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: data })
}
