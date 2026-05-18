import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listBotChannels } from '@/lib/slack'

// Returns the list of channels the Pathwaze bot is in.
// Used by the project-edit drawer to populate the "Linked Slack Channel" picker.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { channels, error } = await listBotChannels()
  return NextResponse.json({ channels, ...(error ? { error } : {}) })
}
