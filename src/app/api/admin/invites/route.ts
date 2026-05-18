import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from '@/lib/email'

const VALID_ROLES = ['admin', 'team', 'investor'] as const

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((me as { role?: string } | null)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('invited_emails')
    .select('email, role, invited_at, accepted_at, invited_by, users:invited_by(full_name)')
    .order('invited_at', { ascending: false }) as unknown as { data: unknown[] | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invites: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role, full_name').eq('id', user.id).single()
  if ((me as { role?: string } | null)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const inviterName = (me as { full_name?: string } | null)?.full_name || user.email?.split('@')[0] || 'A Pathwaze admin'

  const body = await request.json()
  const emails: string[] = Array.isArray(body.emails) ? body.emails : []
  const role: string = VALID_ROLES.includes(body.role) ? body.role : 'team'

  const cleaned = Array.from(new Set(
    emails.map(e => String(e).trim().toLowerCase()).filter(e => e && isValidEmail(e))
  ))
  if (cleaned.length === 0) return NextResponse.json({ error: 'No valid emails provided' }, { status: 400 })

  // Build the absolute login URL from the request
  const origin = new URL(request.url).origin
  const loginUrl = `${origin}/auth/login`

  // Upsert invites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (supabase.from('invited_emails') as any).upsert(
    cleaned.map(email => ({ email, role, invited_by: user.id })),
    { onConflict: 'email' }
  )
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Best-effort email send. Track results so the UI can show which got mailed.
  const results = await Promise.all(cleaned.map(async email => {
    const r = await sendInviteEmail({ to: email, inviterName, loginUrl })
    return { email, sent: r.sent, error: r.error }
  }))
  const sentCount = results.filter(r => r.sent).length
  const sendingConfigured = !!process.env.RESEND_API_KEY

  return NextResponse.json({
    invited: cleaned,
    sent: sentCount,
    sendingConfigured,
    results,
  })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if ((me as { role?: string } | null)?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 })

  const { error } = await supabase.from('invited_emails').delete().eq('email', email.toLowerCase())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
