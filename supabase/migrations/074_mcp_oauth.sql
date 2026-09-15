-- 074 — OAuth 2.1 storage for the Pathwaze MCP server (/api/mcp).
--
-- Claude connects as an OAuth client: it dynamically registers, sends the user
-- through the normal Pathwaze login, then exchanges a PKCE-protected code for
-- an access token. These three tables hold that state.
--
-- All three are service-role-only, exactly like email_connections (049): the
-- route handlers reach them with the service client, and no authenticated
-- policy exists, so a user's own JWT can never read another user's tokens —
-- or their own, for that matter.
--
-- Access tokens are stored as SHA-256 hashes, never in plaintext.

-- Registered OAuth clients (one row per Claude installation that connects).
CREATE TABLE IF NOT EXISTS public.mcp_clients (
  client_id     text PRIMARY KEY,
  client_name   text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One-time authorization codes. Short-lived and burned on first use.
CREATE TABLE IF NOT EXISTS public.mcp_auth_codes (
  code            text PRIMARY KEY,
  client_id       text NOT NULL,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri    text NOT NULL,
  code_challenge  text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope           text,
  resource        text,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_auth_codes_expires_idx ON public.mcp_auth_codes (expires_at);

-- Issued access tokens. `token_hash` is sha256(token + MCP_TOKEN_PEPPER).
CREATE TABLE IF NOT EXISTS public.mcp_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash   text UNIQUE NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id    text,
  client_name  text,
  scope        text,
  expires_at   timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mcp_tokens_user_idx ON public.mcp_tokens (user_id);
CREATE INDEX IF NOT EXISTS mcp_tokens_hash_idx ON public.mcp_tokens (token_hash);

ALTER TABLE public.mcp_clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_tokens     ENABLE ROW LEVEL SECURITY;

-- No authenticated policies on purpose: RLS-enabled with zero policies denies
-- everything except the service role, which bypasses RLS. The /settings UI
-- reads a user's own connections through a server route, not directly.
DROP POLICY IF EXISTS "service only" ON public.mcp_clients;
DROP POLICY IF EXISTS "service only" ON public.mcp_auth_codes;
DROP POLICY IF EXISTS "service only" ON public.mcp_tokens;

-- Housekeeping: drop expired codes whenever a new one is written.
CREATE OR REPLACE FUNCTION public.mcp_purge_expired_codes()
RETURNS trigger AS $$
BEGIN
  DELETE FROM public.mcp_auth_codes WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS mcp_auth_codes_purge ON public.mcp_auth_codes;
CREATE TRIGGER mcp_auth_codes_purge
  AFTER INSERT ON public.mcp_auth_codes
  FOR EACH STATEMENT EXECUTE FUNCTION public.mcp_purge_expired_codes();
