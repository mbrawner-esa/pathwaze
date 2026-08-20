import { createClient as createSbClient } from '@supabase/supabase-js'

// Service-role Supabase client — bypasses RLS. Use only in server routes where
// the auth boundary is something other than a user session (OAuth callback,
// cron, webhooks). `cache: 'no-store'` stops Next.js from caching PostgREST GETs.
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSbClient(url, key, {
    auth: { persistSession: false },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global: { fetch: (input: any, init: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}
