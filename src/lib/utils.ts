import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

/**
 * Is this a date-only value (`YYYY-MM-DD`) rather than a full instant?
 *
 * Postgres `date` columns — task/RFI due dates, permit submitted/approved/expiry,
 * pricing NTP/COD — come back date-only. `timestamptz` columns carry a time and
 * a zone. The two must be parsed differently, and `formatDate` takes both.
 */
function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
}

/**
 * Parse a date-only string as a calendar day in the viewer's local zone.
 *
 * `new Date('2026-08-27')` is midnight **UTC**, which `toLocaleDateString` then
 * renders as the 27th only east of UTC — everyone in the US sees the 26th. That
 * is the reported "due date saves as the day before I selected" bug: the value
 * stored is correct, the render was a day early.
 */
function parseCalendarDay(value: string): Date {
  const [y, m, d] = value.trim().split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Today as `YYYY-MM-DD` in the viewer's local zone (never UTC — see `isPastDue`). */
export function todayISO(): string {
  const n = new Date()
  const mm = String(n.getMonth() + 1).padStart(2, '0')
  const dd = String(n.getDate()).padStart(2, '0')
  return `${n.getFullYear()}-${mm}-${dd}`
}

/**
 * Is a due date in the past? Compared as calendar-day strings, so a task due
 * *today* is never overdue.
 *
 * The `new Date(due) < new Date()` idiom this replaces flipped to true the
 * moment local time passed UTC midnight — mid-morning in the US — so tasks
 * showed as overdue on the day they were actually due.
 */
export function isPastDue(due: string | null | undefined): boolean {
  if (!due) return false
  return due.slice(0, 10) < todayISO()
}

/**
 * Whole dates for display: "Aug 27, 2026". Accepts both `date` and
 * `timestamptz` values — date-only strings are read as calendar days so the
 * day does not shift by zone.
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = isDateOnly(date) ? parseCalendarDay(date) : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Compact date for dense UI: "Sep 18", or "Sep 18 '27" when the year differs
 * from the current one.
 *
 * Dropping the year for the current year is what makes a column of these
 * scannable — in a schedule view most dates share a year, so repeating it is
 * noise that crowds out the part that actually varies.
 *
 * Parsed as calendar days rather than instants: `new Date('2026-09-18')` is
 * midnight UTC, which renders as the 17th for anyone west of UTC.
 */
export function formatShortDate(date: string | null | undefined): string {
  if (!date) return '—'
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  const thisYear = new Date().getFullYear()
  return y === thisYear ? `${month} ${d}` : `${month} ${d} '${String(y).slice(2)}`
}
