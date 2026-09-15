/**
 * POST /api/mcp/oauth/token — exchange an authorization code for an access token.
 *
 * Public client, so there is no client secret; PKCE is what proves the caller
 * is the same app that started the flow. Codes are single-use: the row is
 * deleted before the token is issued, so a replay finds nothing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { verifyPkce, issueToken, MCP_SCOPE } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }

const fail = (error: string, description?: string, status = 400) =>
  NextResponse.json(
    { error, ...(description ? { error_description: description } : {}) },
    { status, headers: { ...cors, 'cache-control': 'no-store' } }
  )

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  })
}

export async function POST(req: NextRequest) {
  // Spec says form-encoded; accept JSON too since some clients send it.
  let params: Record<string, string> = {}
  const contentType = req.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      params = await req.json()
    } else {
      const form = await req.formData()
      form.forEach((v, k) => { params[k] = String(v) })
    }
  } catch {
    return fail('invalid_request', 'Could not parse the request body.')
  }

  if (params.grant_type !== 'authorization_code') {
    return fail('unsupported_grant_type', 'Only authorization_code is supported.')
  }

  const { code, code_verifier, redirect_uri, client_id } = params
  if (!code || !code_verifier) {
    return fail('invalid_request', 'code and code_verifier are required.')
  }

  const svc = serviceClient()
  const { data: row } = await svc
    .from('mcp_auth_codes')
    .select('code,client_id,user_id,redirect_uri,code_challenge,code_challenge_method,scope,expires_at')
    .eq('code', code)
    .maybeSingle()

  if (!row) return fail('invalid_grant', 'Unknown or already-used code.')

  // Burn the code before anything else can go wrong with it.
  await svc.from('mcp_auth_codes').delete().eq('code', code)

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return fail('invalid_grant', 'This code has expired. Start the connection again.')
  }
  if (client_id && client_id !== row.client_id) {
    return fail('invalid_grant', 'client_id does not match the code.')
  }
  if (redirect_uri && redirect_uri !== row.redirect_uri) {
    return fail('invalid_grant', 'redirect_uri does not match the code.')
  }
  if (!verifyPkce(code_verifier, row.code_challenge, row.code_challenge_method)) {
    return fail('invalid_grant', 'PKCE verification failed.')
  }

  const { data: client } = await svc
    .from('mcp_clients')
    .select('client_name')
    .eq('client_id', row.client_id)
    .maybeSingle()

  try {
    const { token, expiresIn } = await issueToken({
      userId: row.user_id,
      clientId: row.client_id,
      clientName: client?.client_name ?? null,
      scope: row.scope,
    })

    return NextResponse.json(
      {
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: row.scope || MCP_SCOPE,
      },
      { headers: { ...cors, 'cache-control': 'no-store' } }
    )
  } catch (err) {
    console.error('[mcp token] issue failed:', err)
    return fail('server_error', 'Could not issue a token.', 500)
  }
}
