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

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
