import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { runTaskDueReminders } from '@/lib/reminders'
import { requireCronAuth } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

// GET /api/cron/task-reminders
// Task due-date digest — overdue plus anything due in the next 3 days.
//
// ⚠️ NOT declared in vercel.json. Vercel **Hobby** allows two cron jobs per
// project and both are taken (rfi-reminders, email-sync), so the scheduled run
// happens inside /api/cron/rfi-reminders, which calls the same worker. This
// route exists purely for manual inspection.
//
// Because the only automated caller is rfi-reminders (which invokes the worker
// directly, not this route), this endpoint **defaults to a dry run**. Sending
// requires an explicit `?send=1`.
//
// That default is deliberate: a bare GET here previously fired a real run
// against production — 11 people got an unsolicited DM and email — while the
// caller was only checking whether the route had deployed. A read-only default
// makes the safe thing the easy thing.
//
//   inspect: /api/cron/task-reminders           -H "Authorization: Bearer $CRON_SECRET"
//   send:    /api/cron/task-reminders?send=1    -H "Authorization: Bearer $CRON_SECRET"
//
// If the project moves to Pro, declare this in vercel.json **with ?send=1** and
// drop the call from rfi-reminders.

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
  const denied = requireCronAuth(req)
  if (denied) return denied

  // Dry unless explicitly told to send. `?dry=0` is not enough — it has to be
  // `?send=1`, so nothing sends by omission or typo.
  const send = req.nextUrl.searchParams.get('send') === '1'
  const dry = !send

  try {
    const report = await runTaskDueReminders(serviceClient(), { dry })
    return NextResponse.json({
      ok: true,
      dry,
      ...(dry ? { note: 'Dry run. Add ?send=1 to actually send.' } : {}),
      ...report,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
