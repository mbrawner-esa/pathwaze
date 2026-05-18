// Shared helper for writing activity_log entries from API routes.
// Ensures the user row exists in public.users (FK target) before insert.
// Always tags entries with project_id so the notification dropdown can deep-link.

import type { SupabaseClient, User } from '@supabase/supabase-js'

interface LogParams {
  entity_type: 'project' | 'task' | 'stakeholder' | 'permit' | 'meter' | 'building' | 'system'
  entity_id: string
  action: string
  project_id?: string | null
  metadata?: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logActivity(supabase: SupabaseClient<any>, user: User, params: LogParams) {
  // Ensure FK target exists (idempotent upsert)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('users') as any).upsert({
    id: user.id,
    email: user.email ?? '',
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    role: 'team',
  }, { onConflict: 'id', ignoreDuplicates: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('activity_log') as any).insert({
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    user_id: user.id,
    metadata: {
      ...(params.metadata ?? {}),
      ...(params.project_id ? { project_id: params.project_id } : {}),
    },
  })
}
