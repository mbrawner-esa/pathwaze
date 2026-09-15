import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // `next` lets a flow resume where it left off — the MCP connector sends
  // users through login mid-OAuth and needs them back on the consent screen.
  // Same-site paths only, so this cannot be turned into an open redirect.
  const next = searchParams.get('next')
  const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  return NextResponse.redirect(`${origin}${safe}`)
}
