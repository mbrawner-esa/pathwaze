-- Raise the 'drawings' Storage bucket per-file size limit.
-- The bucket was created (migration 034) without an explicit file_size_limit,
-- so it fell back to the Supabase project default (~50 MB), which rejected
-- large as-built drawing sets. Bump to 200 MB.
--
-- ⚠️ Run on Supabase. (Storage bucket config is not applied by a Vercel deploy.)
-- Note: very large files may also require Supabase resumable/TUS uploads;
-- 200 MB covers ordinary standard uploads via the JS client.

update storage.buckets
  set file_size_limit = 209715200   -- 200 MB, in bytes
  where id = 'drawings';
