/**
 * POST /api/mcp/oauth/revoke — RFC 7009 token revocation.
 *
 * Always answers 200, even for an unknown token, so this cannot be used to
 * probe which tokens exist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase/service'
import { hashToken } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...cors, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
  })
}

export async function POST(req: NextRequest) {
  let token = ''
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      token = String((await req.json()).token || '')
    } else {
      token = String((await req.formData()).get('token') || '')
    }
  } catch {
    // Fall through — an unparseable body is treated as nothing to revoke.
  }

  if (token) {
    await serviceClient()
      .from('mcp_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', hashToken(token))
  }

  return new NextResponse(null, { status: 200, headers: cors })
}
