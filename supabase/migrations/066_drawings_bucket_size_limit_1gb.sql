-- Raise the 'drawings' Storage bucket per-file size limit again.
-- Migration 044 set it to 200 MB, but full as-built drawing sets run 200 MB to
-- ~1 GB and were still rejected with "The object exceeded the maximum allowed
-- size". Bump to 2 GB to leave headroom. Uploads now go through resumable/TUS
-- (src/lib/storage-upload.ts), which chunks large files reliably.
--
-- ⚠️ Run on Supabase. (Storage bucket config is not applied by a Vercel deploy.)
-- ⚠️ ALSO raise the PROJECT-WIDE storage upload limit in the Supabase dashboard
--    (Storage → Settings → "Upload file size limit") to at least 2 GB — the
--    global cap overrides a higher per-bucket limit, so this SQL alone is not
--    enough if the global limit is still lower.

update storage.buckets
  set file_size_limit = 2147483648   -- 2 GB, in bytes
  where id = 'drawings';
