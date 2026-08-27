import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { runTaskDueReminders } from '@/lib/reminders'

export const dynamic = 'force-dynamic'

// GET /api/cron/task-reminders
// Daily task due-date digest — overdue plus anything due in the next 3 days.
//
// ⚠️ NOT declared in vercel.json. Vercel **Hobby** allows two cron jobs per
// project and both are taken (rfi-reminders, email-sync), so the scheduled run
// happens inside /api/cron/rfi-reminders, which calls the same worker. This
// route exists so the job can be run and inspected on its own:
//     /api/cron/task-reminders?key=$CRON_SECRET&dry=1
// If the project ever moves to Pro, add it to vercel.json and drop the call
// from rfi-reminders.

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSbClient(url, key, {
    auth: { persistSession: false },
    // Same reason as rfi-reminders: Next.js caches PostgREST GETs otherwise,
    // and a cached read here means a silently empty reminder run.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global: { fetch: (input: any, init: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    const key = req.nextUrl.searchParams.get('key') || ''
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const dry = req.nextUrl.searchParams.get('dry') === '1'
  try {
    const report = await runTaskDueReminders(serviceClient(), { dry })
    return NextResponse.json({ ok: true, dry, ...report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
