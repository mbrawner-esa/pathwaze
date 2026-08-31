-- Project complexity — cached LLM scoring of how tangled a project actually is.
--
-- WHY A CACHE AND NOT A LIVE COMPUTATION.
--   Momentum is arithmetic over the activity log, so it is derived on every
--   read. Complexity reads the PROSE — weekly notes and thread messages — and
--   asks a model to judge it. That is a network call measured in seconds and
--   billed per token, which cannot sit in the render path of a dashboard that
--   reloads on every drag. So the score is computed deliberately and stored,
--   and the board renders whatever was last stored.
--
-- WHY THIS IS NOT THE R-14 TREND SNAPSHOT.
--   One row per project, overwritten on each scoring — this is a cache, not a
--   history. R-14 (monthly snapshots for trend analysis) is a separate table
--   with a separate cadence, and should stay that way: mixing "the current
--   value" with "the value over time" in one table makes both harder to query.
--
-- `input_fingerprint` records what the score was computed FROM, so a rescore
-- can be skipped when nothing that feeds it has changed. Without it, a "rescore
-- all" button would re-bill every project on every press.

create table if not exists public.project_complexity (
  project_id        uuid primary key references public.projects(id) on delete cascade,
  -- 1-10. Deliberately coarse: this is a judgement, and a two-decimal score
  -- would imply a precision the underlying method does not have.
  score             integer not null check (score between 1 and 10),
  band              text    not null check (band in ('low', 'moderate', 'high', 'severe')),
  -- Short phrases naming what drove the score, so the number is explainable
  -- rather than oracular.
  drivers           jsonb   not null default '[]'::jsonb,
  summary           text,
  -- Which model produced this. Kept because scores from different models are
  -- not comparable, and a model change should be visible rather than silent.
  model             text,
  input_fingerprint text,
  scored_at         timestamptz not null default now(),
  scored_by         uuid references public.users(id) on delete set null
);

create index if not exists project_complexity_score_idx on public.project_complexity(score desc);

comment on table public.project_complexity is
  'Cached LLM complexity score per project, refreshed on demand. One row per project, overwritten each scoring — a cache of the current judgement, NOT a history. Trend snapshots are roadmap R-14 and belong in their own table.';
comment on column public.project_complexity.input_fingerprint is
  'Hash of the inputs the score was derived from. Lets a rescore skip projects whose notes, threads and counts are unchanged, so re-running the scorer does not re-bill the whole portfolio.';
comment on column public.project_complexity.drivers is
  'JSON array of short strings naming what drove the score. The board shows these on hover so the number is explainable.';

-- ── RLS — follows the 052/068/069 convention (authenticated read + write) ──
alter table public.project_complexity enable row level security;

drop policy if exists project_complexity_select on public.project_complexity;
drop policy if exists project_complexity_write  on public.project_complexity;
create policy project_complexity_select on public.project_complexity for select to authenticated using (true);
create policy project_complexity_write  on public.project_complexity for all    to authenticated using (true) with check (true);

do $$
declare scored integer;
begin
  select count(*) into scored from public.project_complexity;
  raise notice 'project_complexity ready. Scored projects: %.', scored;
end $$;
