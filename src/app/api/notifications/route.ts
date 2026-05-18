import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the 15 most recent activity_log entries for a feed-style notification dropdown.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .from('activity_log')
    .select('id, entity_type, entity_id, action, metadata, created_at, user_id, users(full_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(15) as any)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notifications: data ?? [] })
}
