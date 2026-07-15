-- Saved filter presets — per-user named filter sets for the Projects and Tasks
-- list pages. Each row stores an opaque `filters` JSON blob the client knows how
-- to apply for that scope.
-- ⚠️ Run on Supabase.

create table if not exists public.saved_filters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  scope      text not null check (scope in ('projects', 'tasks')),
  name       text not null,
  filters    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists saved_filters_user_scope_idx on public.saved_filters(user_id, scope);

alter table public.saved_filters enable row level security;

drop policy if exists saved_filters_own on public.saved_filters;
-- A user only ever sees and manages their own presets.
create policy saved_filters_own on public.saved_filters
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.saved_filters is 'Per-user named filter presets for list pages. scope = projects | tasks; filters = client-defined JSON applied on that page.';
