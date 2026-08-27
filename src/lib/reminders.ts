import { sendDM, appUrl } from '@/lib/slack'
import { sendNotificationEmail, escapeHtml } from '@/lib/email'
import { formatDate } from '@/lib/utils'

// Daily task due-date reminders.
//
// Reported gap: a task due yesterday produced no nudge today. This closes it in
// both directions — a heads-up starting 3 days out, and a daily nudge once a
// task is actually late.
//
// One digest per assignee, not one message per task. A PM with six things due
// this week should get one DM listing six lines, not six DMs; that is also what
// keeps the daily cadence tolerable.
//
// ⚠️ Lives in lib/ rather than only in a route because Vercel **Hobby** allows
// two cron jobs per project and both slots are spoken for (rfi-reminders,
// email-sync). `/api/cron/rfi-reminders` calls this at the end of its run, and
// `/api/cron/task-reminders` exposes it for manual and ?dry=1 invocation.

/** Days before the due date that the heads-up starts. */
const LEAD_DAYS = 3

/**
 * The company operates in FL and IL; Vercel runs in UTC. Deriving "today" from
 * the server clock would roll the window over at 8pm ET, so anchor it to a real
 * business timezone instead. `en-CA` because it formats as YYYY-MM-DD.
 */
const PROJECT_TZ = 'America/New_York'

export function projectToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: PROJECT_TZ })
}

/** `YYYY-MM-DD`, `n` calendar days after the project-timezone today. */
function projectDatePlus(n: number): string {
  const [y, m, d] = projectToday().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

interface DueTask {
  id: string
  title: string
  due_date: string
  status: string
  priority: string | null
  assignee_id: string
  project_id: string | null
}

export interface ReminderReport {
  today: string
  horizon: string
  candidates: number
  recipients: number
  notified: number
  // Populated on dry runs so a manual call shows exactly who would be pinged.
  wouldNotify?: Array<{ assignee_id: string; overdue: string[]; upcoming: string[] }>
}

/**
 * Find every open task due within the lead window or already late, group by
 * assignee, and send one Slack DM + one email digest each.
 *
 * Best-effort per recipient: a Slack or email failure for one person is logged
 * and does not stop the rest of the run.
 */
export async function runTaskDueReminders(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { dry?: boolean } = {},
): Promise<ReminderReport> {
  const dry = !!opts.dry
  const today = projectToday()
  const horizon = projectDatePlus(LEAD_DAYS)

  // `date` columns compare correctly as strings, so the whole window is one
  // query: anything not complete, with an assignee, due on or before the horizon.
  // No lower bound — that is what makes overdue tasks keep reporting daily.
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, due_date, status, priority, assignee_id, project_id')
    .neq('status', 'Complete')
    .not('assignee_id', 'is', null)
    .not('due_date', 'is', null)
    .lte('due_date', horizon)
  if (error) throw new Error(error.message)

  const tasks = (data ?? []) as DueTask[]

  // Group by assignee, splitting late from upcoming.
  // Plain objects rather than Map/Set: tsconfig has no `target`, so it defaults
  // to ES5 and spreading a Map iterator does not compile.
  interface Bucket { overdue: DueTask[]; upcoming: DueTask[] }
  const byUser: Record<string, Bucket> = {}
  for (const t of tasks) {
    const bucket: Bucket = byUser[t.assignee_id] ?? { overdue: [], upcoming: [] }
    if (t.due_date < today) bucket.overdue.push(t)
    else bucket.upcoming.push(t)
    byUser[t.assignee_id] = bucket
  }
  const byDue = (a: DueTask, z: DueTask) => a.due_date.localeCompare(z.due_date)
  const userIds = Object.keys(byUser)
  for (const uid of userIds) {
    byUser[uid].overdue.sort(byDue)
    byUser[uid].upcoming.sort(byDue)
  }

  const report: ReminderReport = {
    today, horizon, candidates: tasks.length, recipients: userIds.length, notified: 0,
  }

  if (dry) {
    report.wouldNotify = userIds.map(uid => ({
      assignee_id: uid,
      overdue: byUser[uid].overdue.map((t: DueTask) => `${t.title} (due ${t.due_date})`),
      upcoming: byUser[uid].upcoming.map((t: DueTask) => `${t.title} (due ${t.due_date})`),
    }))
    return report
  }

  // Project names for the digest lines — one query for the whole run.
  const projectIds: string[] = []
  for (const t of tasks) {
    if (t.project_id && projectIds.indexOf(t.project_id) === -1) projectIds.push(t.project_id)
  }
  const projectName: Record<string, string> = {}
  if (projectIds.length) {
    const { data: projs } = await supabase.from('projects').select('id, name').in('id', projectIds)
    for (const pr of (projs ?? []) as Array<{ id: string; name: string }>) projectName[pr.id] = pr.name
  }

  interface DigestLine { title: string; where: string | null; due: string; id: string }

  // Slack link syntax is `<url|label>`, so a title containing < > or | would
  // truncate or break the label. Strip just those three.
  const slackLabel = (v: string) => v.replace(/[<>|]/g, ' ').trim()

  for (const userId of userIds) {
    const bucket = byUser[userId]
    const { data: u } = await supabase
      .from('users')
      .select('email, full_name, notify_slack_task_due, notify_email_task_due')
      .eq('id', userId)
      .maybeSingle() as {
        data: {
          email?: string; full_name?: string
          notify_slack_task_due?: boolean; notify_email_task_due?: boolean
        } | null
      }
    if (!u) continue

    const line = (t: DueTask): DigestLine => ({
      title: t.title,
      where: t.project_id ? (projectName[t.project_id] ?? null) : null,
      due: t.due_date,
      id: t.id,
    })
    const overdue: DigestLine[] = bucket.overdue.map(line)
    const upcoming: DigestLine[] = bucket.upcoming.map(line)

    // ── Slack DM ──
    if (u.notify_slack_task_due !== false) {
      const parts: string[] = []
      if (overdue.length) {
        parts.push(`*⏰ Overdue (${overdue.length})*`)
        parts.push(...overdue.map(t => `• <${appUrl(`/tasks?id=${t.id}`)}|${slackLabel(t.title)}>${t.where ? ` · _${slackLabel(t.where)}_` : ''} — was due ${t.due}`))
      }
      if (upcoming.length) {
        parts.push(`*📅 Due in the next ${LEAD_DAYS} days (${upcoming.length})*`)
        parts.push(...upcoming.map(t => `• <${appUrl(`/tasks?id=${t.id}`)}|${slackLabel(t.title)}>${t.where ? ` · _${slackLabel(t.where)}_` : ''} — ${t.due === today ? 'due today' : `due ${t.due}`}`))
      }
      const text = overdue.length
        ? `You have ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`
        : `You have ${upcoming.length} task${upcoming.length === 1 ? '' : 's'} due soon`
      try {
        await sendDM(supabase, userId, text, [
          { type: 'section', text: { type: 'mrkdwn', text: parts.join('\n') } },
          { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open my tasks' }, url: appUrl('/tasks'), style: 'primary' }] },
        ])
      } catch (e) { console.error('[reminders] slack DM failed for', userId, e) }
    }

    // ── Email ──
    if (u.email && u.notify_email_task_due !== false) {
      const group = (label: string, rows: DigestLine[]) => rows.length ? (
        `<p style="margin:0 0 6px 0;font-weight:700;">${label}</p><ul style="margin:0 0 14px 18px;padding:0;">`
        // Task titles and project names are user-typed; the shell renders
        // `message` raw, so escape the values and keep our own markup.
        + rows.map(t =>
            `<li style="margin-bottom:4px;">${escapeHtml(t.title)}`
            + (t.where ? ` <span style="color:#706E6B;">· ${escapeHtml(t.where)}</span>` : '')
            + ` — ${t.due === today ? 'due today' : `due ${escapeHtml(formatDate(t.due))}`}</li>`,
          ).join('')
        + '</ul>'
      ) : ''

      try {
        await sendNotificationEmail({
          to: u.email,
          recipientName: u.full_name ?? null,
          subject: overdue.length
            ? `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`
            : `${upcoming.length} task${upcoming.length === 1 ? '' : 's'} due soon`,
          heading: 'Your task deadlines',
          message: group(`Overdue (${overdue.length})`, overdue) + group(`Due in the next ${LEAD_DAYS} days (${upcoming.length})`, upcoming),
          ctaLabel: 'Open my tasks',
          ctaUrl: appUrl('/tasks'),
        })
      } catch (e) { console.error('[reminders] email failed for', userId, e) }
    }

    report.notified++
  }

  return report
}
