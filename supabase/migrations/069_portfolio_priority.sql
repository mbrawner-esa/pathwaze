-- Portfolio priority order — the drag-to-reprioritize state behind /health.
--
-- WHY THIS IS NOT `workstream_milestones.sort_order`.
--   That column already exists and already backs a drag-to-reorder gesture, so
--   reusing it is the obvious move and the wrong one: `sort_order` is scoped to
--   one major inside one project ("third step of Design Development on Winter
--   Garden"). It has no meaning ACROSS projects, so two projects both holding
--   sort_order = 1 is normal and says nothing about which matters more. The
--   dashboard ranks PROJECTS against each other, which is a different question
--   with no existing home.
--
-- WHY A TABLE RATHER THAN A COLUMN ON `projects`.
--   The order is a working artifact of a weekly meeting, not a property of the
--   project. Keeping it separate means "has anyone set an order?" is `exists
--   (select 1 from portfolio_priority)` and "go back to sorting by urgency" is
--   a DELETE — both awkward to express in a nullable column, where a reset has
--   to blank N rows and hope none were missed. It also keeps `projects` from
--   growing another column that only one screen reads.
--
-- The rank is deliberately NOT dense or gapless. The API rewrites the whole set
-- on every drag (same approach as the milestone reorder endpoint), so gaps can
-- only appear when a ranked project is later archived or put on hold, and a gap
-- changes nothing about the resulting order.

create table if not exists public.portfolio_priority (
  project_id uuid primary key references public.projects(id) on delete cascade,
  rank       integer not null,
  set_at     timestamptz not null default now(),
  set_by     uuid references public.users(id) on delete set null
);

create index if not exists portfolio_priority_rank_idx on public.portfolio_priority(rank);

comment on table public.portfolio_priority is
  'Manual priority order for the /health dashboard, set by dragging rows in a planning meeting. One row per ranked project; an empty table means nobody has overridden the automatic urgency sort. Distinct from workstream_milestones.sort_order, which orders milestones INSIDE one major and carries no cross-project meaning.';
comment on column public.portfolio_priority.rank is
  'Ascending display position, 1 first. Rewritten wholesale on each reorder, so gaps are harmless and only occur when a ranked project leaves the active set.';
comment on column public.portfolio_priority.set_by is
  'Who last dragged the order. Retained so the dashboard can say whose ordering the team is looking at; nulled rather than cascading if that user is deleted.';

-- ── RLS — follows the 052/068 convention (authenticated read + write) ──
alter table public.portfolio_priority enable row level security;

drop policy if exists portfolio_priority_select on public.portfolio_priority;
drop policy if exists portfolio_priority_write  on public.portfolio_priority;
create policy portfolio_priority_select on public.portfolio_priority for select to authenticated using (true);
create policy portfolio_priority_write  on public.portfolio_priority for all    to authenticated using (true) with check (true);

do $$
declare ranked integer;
begin
  select count(*) into ranked from public.portfolio_priority;
  raise notice 'portfolio_priority ready. Rows: %. (Empty = automatic urgency sort.)', ranked;
end $$;
