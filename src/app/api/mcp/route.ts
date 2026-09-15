/**
 * POST /api/mcp — the Pathwaze MCP endpoint.
 *
 * Stateless JSON-RPC over HTTP (Streamable HTTP without SSE), which is all a
 * read-only tool server needs and avoids the SDK's session-oriented transport
 * fighting Next route handlers.
 *
 * No token -> 401 with a WWW-Authenticate header pointing at the protected
 * resource metadata, which is how a client discovers where to authenticate.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sessionFromBearer, appUrl } from '@/lib/mcp/auth'
import { TOOLS, handlers } from '@/lib/mcp/tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PROTOCOL_VERSION = '2025-06-18'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcResult = (id: any, result: unknown) =>
  NextResponse.json({ jsonrpc: '2.0', id, result })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpcError = (id: any, code: number, message: string, status = 200) =>
  NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } }, { status })

function unauthorized() {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required' } },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': `Bearer realm="Pathwaze", resource_metadata="${appUrl('/.well-known/oauth-protected-resource')}"`,
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const session = await sessionFromBearer(req.headers.get('authorization'))
  if (!session) return unauthorized()

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> }
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, 'Parse error', 400)
  }

  const { id = null, method, params = {} } = body

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'pathwaze', version: '2.0.0' },
        instructions:
          `Pathwaze project data for ${session.fullName || session.email} (role: ${session.role}). ` +
          'Read-only. Start with get_project_context for deep context on one project, ' +
          'or search to find something across the portfolio. Results are limited to ' +
          'what this account is permitted to see.',
      })

    // Notifications carry no id and expect no response body.
    case 'notifications/initialized':
      return new NextResponse(null, { status: 202 })

    case 'ping':
      return rpcResult(id, {})

    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })

    case 'tools/call': {
      const name = params.name as string
      const fn = handlers[name]
      if (!fn) return rpcError(id, -32602, `Unknown tool: ${name}`)

      try {
        const data = await fn(session, (params.arguments as Record<string, unknown>) || {})
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        })
      } catch (err) {
        // Tool failures come back as a result with isError, not a protocol
        // error, so the model can read the message and adjust.
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[mcp] ${name} failed for ${session.email}:`, message)
        return rpcResult(id, { content: [{ type: 'text', text: message }], isError: true })
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`)
  }
}

/** A bare GET is used by some clients to probe auth before opening a stream. */
export async function GET(req: NextRequest) {
  const session = await sessionFromBearer(req.headers.get('authorization'))
  if (!session) return unauthorized()
  return NextResponse.json({
    name: 'pathwaze',
    version: '2.0.0',
    transport: 'streamable-http',
    authenticated_as: { name: session.fullName, role: session.role },
  })
}
