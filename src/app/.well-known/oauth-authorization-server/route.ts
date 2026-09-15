/**
 * RFC 8414 authorization-server metadata.
 *
 * Advertises the endpoints and the fact that we support Dynamic Client
 * Registration and PKCE, which is what lets Claude connect without anyone
 * pre-provisioning a client id.
 */
import { NextResponse } from 'next/server'
import { appUrl, MCP_SCOPE } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      issuer: appUrl(''),
      authorization_endpoint: appUrl('/api/mcp/oauth/authorize'),
      token_endpoint: appUrl('/api/mcp/oauth/token'),
      registration_endpoint: appUrl('/api/mcp/oauth/register'),
      revocation_endpoint: appUrl('/api/mcp/oauth/revoke'),
      scopes_supported: [MCP_SCOPE],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}
