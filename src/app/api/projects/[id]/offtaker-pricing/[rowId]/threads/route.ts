import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { appUrl } from '@/lib/slack'
import { logActivity } from '@/lib/activity'
import { parseTokenMentions, emailUser } from '@/lib/rfi-notify'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rowId } = await params
  const { data, error } = await supabase
    .from('offtaker_pricing_threads')
    .select('*')
    .eq('row_id', rowId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: projectId, rowId } = await params
  const body = await req.json()
  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  // Resolve the poster's display name + avatar so threads render without a join later.
  const { data: profile } = await supabase.from('users').select('full_name, avatar_url').eq('id', user.id).single() as { data: { full_name?: string; avatar_url?: string | null } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('offtaker_pricing_threads') as any)
    .insert({
      row_id: rowId,
      user_id: user.id,
      user_name: profile?.full_name ?? user.email?.split('@')[0] ?? 'User',
      user_avatar_url: profile?.avatar_url ?? null,
      message: body.message.trim(),
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── @-mentions in the message → notify each mentioned user (feed + email) ──
  try {
    const mentioned = parseTokenMentions(body.message).filter((uid: string) => uid !== user.id)
    if (mentioned.length) {
      const pricingUrl = appUrl(`/projects/${projectId}?tab=financial`)
      for (const uid of mentioned) {
        await logActivity(supabase, user, { entity_type: 'project', entity_id: projectId, action: 'mentioned you in a pricing thread', project_id: projectId, metadata: { mentioned_user_id: uid, row_id: rowId } })
        await emailUser(supabase, uid, { subject: 'You were mentioned in an offtaker pricing thread', heading: 'You were mentioned', message: 'You were mentioned in an offtaker pricing discussion.', ctaLabel: 'Open pricing', ctaUrl: pricingUrl })
      }
    }
  } catch (e) {
    console.warn('[mentions] offtaker pricing thread notify failed:', e)
  }

  return NextResponse.json(data)
}
