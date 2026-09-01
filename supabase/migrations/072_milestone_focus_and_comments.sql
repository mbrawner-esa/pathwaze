-- This week's focus, and a comment thread to carry the reasoning.
--
-- WHY THIS REPLACES THE UPVOTE TALLY (migration 071).
--   A tally answers "how much do we collectively want this", which is a
--   question nobody in a delivery meeting actually asks. What gets asked is
--   "what are we working on this week" — a binary, decided out loud, by the
--   person running the meeting. A checkbox says that in one click; a vote count
--   says it in a number somebody then has to interpret.
--
--   071 is dropped below. It shipped one commit ago and was never usable for a
--   full cycle, so there is no history worth preserving; leaving an unread
--   table behind would just be a thing to explain later.
--
-- FOCUS IS SHARED, NOT PER-USER. One row per milestone, not one per person per
--   milestone. The board is where a Director sets the week's direction, so a
--   focus only its author could see would defeat the point — the whole value is
--   that everyone opens their dashboard and sees the same short list.

-- ── the superseded tally ──────────────────────────────────────────────
drop table if exists public.workstream_milestone_votes;

-- ── focus ─────────────────────────────────────────────────────────────
create table if not exists public.workstream_milestone_focus (
  milestone_id uuid primary key references public.workstream_milestones(id) on delete cascade,
  set_at       timestamptz not null default now(),
  set_by       uuid references public.users(id) on delete set null
);

create index if not exists ws_milestone_focus_set_at_idx on public.workstream_milestone_focus(set_at desc);

comment on table public.workstream_milestone_focus is
  'Milestones marked as this week''s focus on the /health board. One row per milestone — focus is a shared team decision, not a per-person bookmark. Presence IS the flag; unfocusing is a DELETE. Replaces the upvote tally in the dropped workstream_milestone_votes.';
comment on column public.workstream_milestone_focus.set_by is
  'Who marked it. Kept so the dashboard can say whose call this was; nulled rather than cascading if that user is deleted.';

-- ── comments ──────────────────────────────────────────────────────────
-- Context, instructions and back-and-forth on a specific milestone. Distinct
-- from `workstream_milestones.notes` (one editable body, last writer wins) and
-- from `workstream_updates` (a weekly narrative for a whole workstream): this
-- is a conversation attached to one line of work.
create table if not exists public.workstream_milestone_comments (
  id           uuid primary key default uuid_generate_v4(),
  milestone_id uuid not null references public.workstream_milestones(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  body         text not null,   -- rich text (RichTextEditor HTML, @-mentions inside)
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);

create index if not exists ws_milestone_comments_ms_idx
  on public.workstream_milestone_comments(milestone_id, created_at);

comment on table public.workstream_milestone_comments is
  'Comment thread on a single milestone — context and instructions for the people delivering it. Not the same as milestones.notes (one body, last writer wins) or workstream_updates (a weekly narrative per workstream).';

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.workstream_milestone_focus    enable row level security;
alter table public.workstream_milestone_comments enable row level security;

drop policy if exists ws_milestone_focus_select on public.workstream_milestone_focus;
drop policy if exists ws_milestone_focus_write  on public.workstream_milestone_focus;
create policy ws_milestone_focus_select on public.workstream_milestone_focus
  for select to authenticated using (true);
create policy ws_milestone_focus_write  on public.workstream_milestone_focus
  for all    to authenticated using (true) with check (true);

drop policy if exists ws_milestone_comments_select on public.workstream_milestone_comments;
drop policy if exists ws_milestone_comments_insert on public.workstream_milestone_comments;
drop policy if exists ws_milestone_comments_update on public.workstream_milestone_comments;
drop policy if exists ws_milestone_comments_delete on public.workstream_milestone_comments;

create policy ws_milestone_comments_select on public.workstream_milestone_comments
  for select to authenticated using (true);
create policy ws_milestone_comments_insert on public.workstream_milestone_comments
  for insert to authenticated with check (user_id = auth.uid());
-- Editing and deleting are limited to the author: a comment is attributed, so
-- letting anyone rewrite one would make the attribution a lie.
create policy ws_milestone_comments_update on public.workstream_milestone_comments
  for update to authenticated using (user_id = auth.uid());
create policy ws_milestone_comments_delete on public.workstream_milestone_comments
  for delete to authenticated using (user_id = auth.uid());

do $$
declare f integer; c integer;
begin
  select count(*) into f from public.workstream_milestone_focus;
  select count(*) into c from public.workstream_milestone_comments;
  raise notice 'Focus rows: %. Milestone comments: %.', f, c;
end $$;
