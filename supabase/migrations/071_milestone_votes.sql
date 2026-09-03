-- Milestone upvotes — the prioritization mechanism for the /health board.
--
-- WHY THIS REPLACES DRAG-TO-REORDER.
--   A dragged list is ONE person's opinion, stored as though it were the team's.
--   Whoever dragged last wins, the ordering carries no argument, and there is no
--   way to see that four people wanted a milestone versus one. A vote per person
--   makes the priority legible: the count IS the case for the ranking, and it is
--   attributable.
--
--   `portfolio_priority` (migration 069) is left in place but is no longer read
--   by the board. It is not dropped here: dropping it is a one-line follow-up
--   once the vote model has been used for a cycle and nobody wants the manual
--   order back.
--
-- ONE ROW PER (milestone, user) — the primary key enforces one vote per person,
-- so a tally can never be inflated by clicking twice. Un-voting is a DELETE.

create table if not exists public.workstream_milestone_votes (
  milestone_id uuid not null references public.workstream_milestones(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (milestone_id, user_id)
);

create index if not exists ws_milestone_votes_ms_idx   on public.workstream_milestone_votes(milestone_id);
create index if not exists ws_milestone_votes_user_idx on public.workstream_milestone_votes(user_id);

comment on table public.workstream_milestone_votes is
  'Upvotes marking a milestone as a priority for the week, one row per person per milestone. The count is the team''s priority signal on the /health board, replacing the single-author drag order in portfolio_priority.';

-- ── RLS ───────────────────────────────────────────────────────────────
-- Read is open to authenticated users so everyone sees the same tally. Writes
-- are restricted to the voter's OWN row: a vote is a personal act, and letting
-- anyone insert under another user_id would make the count meaningless.
alter table public.workstream_milestone_votes enable row level security;

drop policy if exists ws_milestone_votes_select on public.workstream_milestone_votes;
drop policy if exists ws_milestone_votes_insert on public.workstream_milestone_votes;
drop policy if exists ws_milestone_votes_delete on public.workstream_milestone_votes;

create policy ws_milestone_votes_select on public.workstream_milestone_votes
  for select to authenticated using (true);
create policy ws_milestone_votes_insert on public.workstream_milestone_votes
  for insert to authenticated with check (user_id = auth.uid());
create policy ws_milestone_votes_delete on public.workstream_milestone_votes
  for delete to authenticated using (user_id = auth.uid());

do $$
declare v integer;
begin
  select count(*) into v from public.workstream_milestone_votes;
  raise notice 'workstream_milestone_votes ready. Votes: %.', v;
end $$;
