/**
 * POST /api/mcp/oauth/register — RFC 7591 Dynamic Client Registration.
 *
 * Claude registers itself here before starting the auth flow, so no one has to
 * hand-provision a client id. Public clients only: no secret is issued, and
 * PKCE is what actually binds the code to the client.
 *
 * Registration grants nothing on its own — the user still has to sign in and
 * approve at /api/mcp/oauth/authorize.
 */
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { serviceClient } from '@/lib/supabase/service'
import { MCP_SCOPE } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } })
}

export async function POST(req: NextRequest) {
  let body: { client_name?: string; redirect_uris?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400, headers: cors })
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : []
  if (!redirectUris.length) {
    return NextResponse.json(
      { error: 'invalid_redirect_uri', error_description: 'At least one redirect_uri is required.' },
      { status: 400, headers: cors }
    )
  }

  // Reject anything that isn't https or a loopback callback — a registered
  // http:// redirect on a public host would let a code be intercepted.
  for (const uri of redirectUris) {
    let parsed: URL
    try {
      parsed = new URL(uri)
    } catch {
      return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400, headers: cors })
    }
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
    if (parsed.protocol !== 'https:' && !isLoopback) {
      return NextResponse.json(
        { error: 'invalid_redirect_uri', error_description: 'redirect_uri must be https, or loopback for local clients.' },
        { status: 400, headers: cors }
      )
    }
  }

  const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : 'MCP client'

  const { error } = await serviceClient().from('mcp_clients').insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  })

  if (error) {
    console.error('[mcp register] insert failed:', error.message)
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: cors })
  }

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: MCP_SCOPE,
    },
    { status: 201, headers: cors }
  )
}
