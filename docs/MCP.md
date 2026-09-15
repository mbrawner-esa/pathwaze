# Pathwaze MCP server

Read-only access to Pathwaze from Claude (CoWork, Desktop, Code), shared across
the organization and **authenticated as the person using it**.

There are no keys to distribute and nothing to install. A teammate adds the
connector once, signs in with their normal Pathwaze login, and Claude can then
read what they can read — nothing more.

---

## How authorization works

Every MCP request mints a **five-minute Supabase JWT for the calling user** and
hands that to PostgREST. Row Level Security then decides what comes back.

That is the whole security model, and it is deliberate: an MCP server is driven
by a model, so a buggy or prompt-injected tool call must not be able to widen
its own access. Because the database is the boundary, the worst case is an empty
result rather than a leak.

**There is no service-role path to row data.** The service key is used in
exactly two places, neither of which returns project data:

1. The `mcp_*` OAuth bookkeeping tables.
2. The OpenAPI schema document, which Supabase serves *only* to the service
   role — a user JWT gets `401 Only the service_role API key can be used for
   this`. It returns table and column names, which is what `list_tables` and
   `describe_table` report. Knowing a table exists gets you nothing: reading it
   still goes through your own JWT, and the names are already visible to anyone
   using the app.

| Role | Through the connector |
|---|---|
| admin | Everything |
| manager | Everything |
| team | All projects; not financials |
| investor | **Refused** at the authorize endpoint |

Investors are blocked even though RLS would already confine them to their
granted projects — an external party should not be pointing an agent at the
portfolio at all.

### Tokens

| | |
|---|---|
| **Access token** (what Claude holds) | Opaque random string, stored only as a SHA-256 hash, 30-day expiry, revocable from /settings |
| **Supabase JWT** (what reaches the database) | Minted per request, 5-minute expiry, never stored, never sent to the client |

Roles are re-checked on **every** call, not just at connection time, so a
demotion or deactivation takes effect immediately.

---

## Setup

### 1. Run the migrations (manual, on Supabase)

| Migration | What it does |
|---|---|
| `073_rls_role_alignment.sql` | Adds `FOR SELECT` policies for manager and team across the ~44 read tables |
| `074_mcp_oauth.sql` | `mcp_clients`, `mcp_auth_codes`, `mcp_tokens` — all service-role-only |

**073 deserves a careful read before you run it.** Until now the permission
model described in `CLAUDE.md` lived only in application code; live RLS still
had the policies from `001`, which predate the manager role. This migration
makes the database enforce what the docs already claimed — which means team
members genuinely gain read access they did not have. It is additive and
read-only (it cannot widen anyone's write access), and it folds in the unrun
`067`.

See the change for yourself, before and after:

```bash
node scripts/check-rls-roles.mjs
```

### 2. Environment variables

Add to **Vercel** (Production + Preview) and to `.env.local`:

| Var | Where it comes from |
|---|---|
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret |
| `MCP_TOKEN_PEPPER` | `openssl rand -base64 32` (already generated in `.env.local`) |

Both must be **identical** in the two places — local dev and prod share one
database, the same trap that `TOKEN_ENC_KEY` hit during the Outlook work.

### 3. Verify

```bash
node scripts/verify-mcp.mjs https://pathwaze.esa-solar.com
```

Drives the whole flow — registration, PKCE, token exchange, replay rejection,
every tool, revocation — and cleans up after itself.

### 4. Share it

An org admin adds it once in Claude → Settings → Connectors → Add custom
connector:

```
https://pathwaze.esa-solar.com/api/mcp
```

Teammates then see **Pathwaze** in their connector list and click Connect.

---

## Tools

| Tool | Returns |
|---|---|
| `get_project_context` | **The main one.** One project, fully expanded: every note, every Slack/email thread message, every task with its full message history, files, links and subtasks, every workstream with all milestones, comments, gates and weekly updates, all stakeholders, buildings, meters, systems, permits, pricing versions, RFIs with all responses, drawings with review findings, financials, risk, stage and activity log |
| `get_portfolio_context` | The same expansion across every project, paged via `next_cursor` |
| `list_projects` | One-line summary of each project |
| `search` | Free text across 12 tables at once — notes, threads, tasks, task messages, milestones, updates, milestone comments, RFIs, responses, stakeholders, permits, findings |
| `get_project_threads` | Every message on a project, Slack + mirrored Outlook email |
| `get_project_notes` | Every note, chronological |
| `list_tasks` | Tasks, optionally with full discussion |
| `get_workstreams` | Majors, owners, milestones, gates, weekly updates |
| `list_rfis` | RFIs with ball-in-court and every response |
| `list_stakeholders` | CRM directory with per-stakeholder to-dos |
| `get_activity` | The audit feed |
| `list_tables` / `describe_table` | Live schema shape — what exists, not what you can read |
| `query_table` | Direct filtered reads of any table, RLS-scoped |
| `list_users` | Users, roles, titles |
| `whoami` | Which account this connection is authenticated as |

---

## Code

| Path | Role |
|---|---|
| `src/app/api/mcp/route.ts` | The endpoint — stateless JSON-RPC over HTTP |
| `src/app/api/mcp/oauth/*` | Register, authorize (consent screen), token, revoke |
| `src/app/.well-known/oauth-*` | Discovery documents |
| `src/lib/mcp/auth.ts` | Token issue/verify, Supabase JWT minting |
| `src/lib/mcp/query.ts` | PostgREST reads carrying the user's JWT |
| `src/lib/mcp/context.ts` | Full-fidelity context assembly |
| `src/lib/mcp/tools.ts` | Tool definitions and handlers |
| `src/app/api/mcp/connections/route.ts` | The user's own connections, for /settings |

### Adding a tool

Add the definition to `TOOLS` and a handler to `handlers` in
`src/lib/mcp/tools.ts`. Handlers receive the caller's session and must read row
data through `get()` in `query.ts` — never the service client, or the RLS
boundary is lost. The only sanctioned service-role read is `openApiSpec()`, and
only because Supabase refuses to serve that document any other way.

---

## Notes

- **Read-only by construction.** Every data path is an HTTP `GET`. There is no
  write handler, and RPC endpoints are excluded from `list_tables`.
- **`email_connections` is never exposed.** It holds encrypted Outlook refresh
  tokens and stays service-role-only.
- **Large payloads.** `get_portfolio_context` pages rather than returning the
  whole portfolio (~3 MB) in one response.
