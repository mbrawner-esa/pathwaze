-- What's New announcements — track which release note each user has already
-- dismissed, so the login modal fires once per release instead of every visit.
-- Stores the release *key* (not a boolean) so shipping the next update is a
-- one-line content change: bump RELEASE.key in src/lib/whats-new.ts and every
-- user sees the modal again.
-- ⚠️ Run on Supabase.

alter table public.users
  add column if not exists whats_new_seen text;

comment on column public.users.whats_new_seen is
  'Key of the most recent What''s New release this user dismissed (see RELEASE.key in src/lib/whats-new.ts). NULL = has never dismissed one.';
