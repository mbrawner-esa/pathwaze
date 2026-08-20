-- Per-user Outlook (Microsoft Graph) email connections.
-- Stores each user's OAuth refresh token (ENCRYPTED at rest via TOKEN_ENC_KEY)
-- plus the delta cursor for the incremental mail sync that mirrors stakeholder
-- emails into project threads.
--
-- Service-role only: RLS is enabled with NO authenticated policies on purpose,
-- so tokens are never readable through the anon/user PostgREST client. All
-- access goes through server routes that use the service-role key
-- (OAuth callback, disconnect, email-sync cron, settings status read).

CREATE TABLE IF NOT EXISTS public.email_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'microsoft',
  account_email TEXT,
  refresh_token_enc TEXT,          -- AES-256-GCM ciphertext, never plaintext
  access_token TEXT,               -- short-lived; cached to avoid refresh every run
  expires_at TIMESTAMPTZ,
  delta_link TEXT,                 -- Graph messages delta cursor (per mailbox)
  scopes TEXT,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT
);

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies for role `authenticated`. Only the service role
-- (which bypasses RLS) reads or writes this table.
