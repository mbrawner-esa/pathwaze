-- Free-form comments on a drawing review — a discussion thread beyond the
-- structured action-plan questions, for anything reviewers want to note.
-- ⚠️ Run on Supabase.

create table if not exists public.review_comments (
  id                uuid primary key default gen_random_uuid(),
  drawing_review_id uuid not null references public.drawing_reviews(id) on delete cascade,
  body              text not null,
  author_id         uuid references public.users(id),
  created_at        timestamptz not null default now()
);

create index if not exists review_comments_review_idx on public.review_comments(drawing_review_id);

alter table public.review_comments enable row level security;
drop policy if exists review_comments_select on public.review_comments;
drop policy if exists review_comments_write  on public.review_comments;
create policy review_comments_select on public.review_comments for select to authenticated using (true);
-- Anyone may post; a comment can only be edited/removed by its author.
create policy review_comments_write on public.review_comments for all to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

comment on table public.review_comments is 'Free-form discussion comments on a drawing review, separate from action-plan findings.';
