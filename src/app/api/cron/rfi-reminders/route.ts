import { createClient as createSbClient } from '@supabase/supabase-js'
import { sendDM } from '@/lib/slack'
import { emailUser, emailStakeholder, rfiUrl, rfiNo } from '@/lib/rfi-notify'
import { runTaskDueReminders } from '@/lib/reminders'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Service-role client — cron runs without a user session, so it must bypass RLS.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSbClient(url, key, {
    auth: { persistSession: false },
    // Bypass Next.js's fetch cache so PostgREST GETs always read fresh data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global: { fetch: (input: any, init: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

// GET /api/cron/rfi-reminders
// Daily job, two parts:
//   (1) nudge the ball-in-court on every open, overdue RFI;
//   (2) send each assignee their task due-date digest (overdue + next 3 days).
//
// (2) is bolted on here rather than given its own schedule because Vercel
// **Hobby** allows two cron jobs per project and both slots are taken by this
// route and email-sync. The worker lives in `@/lib/reminders` and is also
// reachable at /api/cron/task-reminders for manual and dry runs.
//
// Protect with CRON_SECRET (Vercel Cron sends it as a Bearer token / ?key=).
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
  const supabase = serviceClient()
  const today = new Date().toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overdue, error } = await (supabase.from('rfis') as any)
    .select('id, rfi_number, subject, due_date, ball_in_court_user_id, ball_in_court_stakeholder_id')
    .eq('status', 'open').lt('due_date', today)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let notified = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wouldNotify: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (overdue ?? []) as any[]) {
    const tag = `RFI ${rfiNo(r.rfi_number)}`
    const text = `⏰ ${tag} is overdue (due ${r.due_date}): ${r.subject}`
    const msg = { subject: `Overdue: ${tag}`, heading: `${tag} is overdue`, message: `<b>${r.subject}</b> — was due ${r.due_date}.`, ctaLabel: 'Open RFI', ctaUrl: rfiUrl(r.id) }
    const target = r.ball_in_court_user_id ? `user:${r.ball_in_court_user_id}` : r.ball_in_court_stakeholder_id ? `stakeholder:${r.ball_in_court_stakeholder_id}` : null
    if (dry) { wouldNotify.push({ rfi: tag, subject: r.subject, due_date: r.due_date, target }); continue }
    if (r.ball_in_court_user_id) {
      await sendDM(supabase, r.ball_in_court_user_id, text)
      await emailUser(supabase, r.ball_in_court_user_id, msg)
      notified++
    } else if (r.ball_in_court_stakeholder_id) {
      await emailStakeholder(supabase, r.ball_in_court_stakeholder_id, msg)
      notified++
    }
  }

  // ── Part 2: task due-date digests ──
  // Isolated so a failure here still reports the RFI half of the run.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taskReminders: any
  try {
    taskReminders = await runTaskDueReminders(supabase, { dry })
  } catch (e) {
    taskReminders = { error: e instanceof Error ? e.message : String(e) }
  }

  if (dry) return NextResponse.json({ ok: true, dry: true, overdue: (overdue ?? []).length, wouldNotify, taskReminders })
  return NextResponse.json({ ok: true, overdue: (overdue ?? []).length, notified, taskReminders })
}
