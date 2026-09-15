/**
 * RFC 9728 protected-resource metadata.
 *
 * The first thing a client fetches after /api/mcp answers 401 — it says which
 * authorization server protects this resource. Here that is the Pathwaze app
 * itself, so users authenticate with the login they already have.
 */
import { NextResponse } from 'next/server'
import { appUrl, MCP_SCOPE } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      resource: appUrl('/api/mcp'),
      authorization_servers: [appUrl('')],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Pathwaze',
      resource_documentation: appUrl('/settings'),
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}
