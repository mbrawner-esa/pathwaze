'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, AlertTriangle, Lock, RotateCcw } from 'lucide-react'

const HEALTH_OPTIONS = ['On Track', 'At Risk', 'Delayed', 'TBD']

const HEALTH_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'On Track':  { bg: '#f0fdf4', text: '#15803d', dot: '#22c55e' },
  'At Risk':   { bg: '#fefce8', text: '#854d0e', dot: '#eab308' },
  'Delayed':   { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
  'TBD':       { bg: '#f8fafc', text: '#475569', dot: '#94a3b8' },
}

export function EditableDealHealth({
  projectId,
  initial,
  suggestion,
  overridden = false,
}: {
  projectId: string
  initial: string
  /**
   * True once someone has deliberately set a value against the suggestion.
   * Majors move, so the suggestion will sometimes be wrong or simply not worth
   * acting on; this records that the disagreement is intentional and stops the
   * prompt asking again until it is cleared.
   */
  overridden?: boolean
  /**
   * What the workstreams say, derived from milestone dates against baseline.
   * Advisory only — deal health also carries what the schedule cannot see
   * (customer sentiment, financing, a competitor), so the human value stays the
   * source of truth. Surfacing the disagreement is the whole point: a green deal
   * sitting on three delayed workstreams is a conversation worth having.
   */
  suggestion?: { value: string; reason: string }
}) {
  const router = useRouter()
  const [value, setValue] = useState(initial || 'TBD')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setValue(initial || 'TBD') }, [initial])

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function pick(next: string) {
    if (next === value) { setOpen(false); return }
    setSaving(true)
    setValue(next) // optimistic
    setOpen(false)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Choosing by hand IS the override: it stops the prompt re-asking about a
        // decision that has just been made.
        body: JSON.stringify({ deal_health: next, deal_health_override: true }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        // revert
        setValue(initial)
      }
    } catch {
      setValue(initial)
    }
    setSaving(false)
  }

  const c = HEALTH_COLORS[value] || HEALTH_COLORS['TBD']

  // Only worth showing when it disagrees, and only once the schedule has enough
  // dates to have an opinion. A suggestion that merely agrees is noise.
  const mismatch = suggestion
    && suggestion.value !== 'TBD'
    && suggestion.value !== value
  const suggestionColors = suggestion ? (HEALTH_COLORS[suggestion.value] ?? HEALTH_COLORS['TBD']) : null

  /** Record that the current value is deliberate, or hand control back. */
  async function setOverride(next: boolean) {
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_health_override: next }),
      })
      router.refresh()
    } catch { /* leave the value as-is; the next render will re-read it */ }
    setSaving(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-all hover:brightness-95"
        style={{ background: c.bg, color: c.text }}
        title={overridden
          ? 'Set by hand, against what the workstreams suggest. Click to change.'
          : mismatch
            ? `Workstreams suggest ${suggestion!.value}. ${suggestion!.reason} Click to change.`
            : 'Click to change project status'}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
        {value}
        {/* Inline, next to the value: a lock when the value is deliberate, an
            alert when the workstreams disagree and nobody has decided yet. */}
        {overridden
          ? <Lock size={10} className="opacity-60 shrink-0" />
          : mismatch && <AlertTriangle size={10} className="shrink-0" style={{ color: suggestionColors!.dot }} />}
        <ChevronDown size={11} strokeWidth={2.5} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-xl border border-[#e2e8f0] py-1 w-[248px] z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#706E6B] border-b border-[#f1f5f9]">
            Project Status
          </div>
          {HEALTH_OPTIONS.map(opt => {
            const oc = HEALTH_COLORS[opt]
            const active = opt === value
            const isSuggested = suggestion?.value === opt && opt !== 'TBD'
            return (
              <button
                key={opt}
                onClick={() => pick(opt)}
                title={isSuggested ? suggestion!.reason : undefined}
                className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 hover:bg-[#f8fafc] ${active ? 'bg-[#fafbfc]' : ''}`}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: oc.dot }} />
                <span className="text-[#181818]" style={{ fontWeight: active ? 600 : 400 }}>{opt}</span>
                {/* The workstreams' answer, marked in place rather than argued
                    for in a separate banner. */}
                {isSuggested && (
                  <span
                    className="ml-auto text-[9.5px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded"
                    style={{ background: oc.bg, color: oc.text }}
                  >
                    Workstreams
                  </span>
                )}
              </button>
            )
          })}

          {suggestion && (
            <div className="border-t border-[#f1f5f9] mt-1 pt-1.5 px-3 pb-2">
              <p className="m-0 text-[11px] leading-snug text-[#706E6B]">
                {suggestion.value === 'TBD'
                  ? 'Workstreams have no opinion yet — no milestone has a target date.'
                  : suggestion.reason}
              </p>
              <button
                type="button"
                onClick={() => { setOverride(!overridden); setOpen(false) }}
                disabled={saving}
                className="flex items-center gap-1.5 mt-1.5 text-[11px] font-semibold text-[#55677A] hover:text-[#181818]"
                title={overridden
                  ? 'Follow the workstreams again, so the suggestion can prompt when it disagrees.'
                  : 'Keep this value and stop prompting once the workstreams have dates. Majors move, so the suggestion will not always be the call you want.'}
              >
                {overridden
                  ? <><RotateCcw size={11} /> Follow Workstreams</>
                  : <><Lock size={11} /> Set Manually</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>

  )
}
