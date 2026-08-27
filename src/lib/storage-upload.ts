import { Upload } from 'tus-js-client'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface ResumableUploadOpts {
  bucket: string
  path: string
  file: File
  contentType?: string
  upsert?: boolean
  onProgress?: (pct: number) => void
}

// Resumable (TUS) upload straight to Supabase Storage, chunked at 6 MB (the size
// Supabase's resumable endpoint requires). Large drawing sets — 200 MB up to
// ~1 GB — upload reliably and survive transient network drops, which a single
// all-at-once `.upload()` cannot. Still bypasses the app server (browser →
// Supabase), so it's subject to the bucket's file_size_limit and RLS.
export async function uploadResumable({
  bucket, path, file, contentType, upsert = false, onProgress,
}: ResumableUploadOpts): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Your session expired — please sign in again and retry.')

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        'x-upsert': String(upsert),
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: contentType || file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress?.(total ? Math.round((sent / total) * 100) : 0),
      onSuccess: () => resolve(),
    })
    // Resume a matching partial upload if one is on record (same file/path).
    upload.findPreviousUploads()
      .then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0])
        upload.start()
      })
      .catch(() => upload.start())
  })
}
