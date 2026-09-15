/**
 * The signed-in user's own MCP connections, for the Settings page.
 *
 * GET    lists them.
 * DELETE ?id=<uuid> revokes one.
 *
 * Authenticated by the normal Pathwaze cookie session — not by an MCP token —
 * and every query is pinned to the caller's own user id, because mcp_tokens is
 * service-role-only and has no RLS policy to lean on.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await serviceClient()
    .from('mcp_tokens')
    .select('id,client_name,created_at,last_used_at,expires_at,revoked_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  return NextResponse.json({
    connections: (data || []).filter((c) => new Date(c.expires_at).getTime() > now),
  })
}

export async function DELETE(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // Scoped to the caller, so one user cannot revoke another's connection.
  const { error } = await serviceClient()
    .from('mcp_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
