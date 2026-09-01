-- Project risk — cached LLM scoring of how likely a project is to fail or stall.
--
-- WHY A CACHE AND NOT A LIVE COMPUTATION.
--   Momentum is arithmetic over the activity log, so it is derived on every
--   read. Risk reads the PROSE — weekly notes and thread messages — and asks a
--   model to judge what could derail the project. That is a network call measured in seconds and
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

create table if not exists public.project_risk (
  project_id        uuid primary key references public.projects(id) on delete cascade,
  -- 1-10, where 10 is "likely to fail or stall badly". Deliberately coarse:
  -- this is a judgement, and a two-decimal score would imply a precision the
  -- underlying method does not have.
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

create index if not exists project_risk_score_idx on public.project_risk(score desc);

comment on table public.project_risk is
  'Cached LLM risk score per project — how likely it is to fail, stall or blow its dates, judged from weekly notes and thread correspondence. Refreshed on demand. One row per project, overwritten each scoring — a cache of the current judgement, NOT a history. Trend snapshots are roadmap R-14 and belong in their own table.';
comment on column public.project_risk.input_fingerprint is
  'Hash of the inputs the score was derived from. Lets a rescore skip projects whose notes, threads and counts are unchanged, so re-running the scorer does not re-bill the whole portfolio.';
comment on column public.project_risk.drivers is
  'JSON array of short strings naming what drove the score. The board shows these on hover so the number is explainable.';

-- ── RLS — follows the 052/068/069 convention (authenticated read + write) ──
alter table public.project_risk enable row level security;

drop policy if exists project_risk_select on public.project_risk;
drop policy if exists project_risk_write  on public.project_risk;
create policy project_risk_select on public.project_risk for select to authenticated using (true);
create policy project_risk_write  on public.project_risk for all    to authenticated using (true) with check (true);

do $$
declare scored integer;
begin
  select count(*) into scored from public.project_risk;
  raise notice 'project_risk ready. Scored projects: %.', scored;
end $$;
