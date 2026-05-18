'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

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
}: {
  projectId: string
  initial: string
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
        body: JSON.stringify({ deal_health: next }),
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

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-all hover:brightness-95"
        style={{ background: c.bg, color: c.text }}
        title="Click to change project status"
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
        {value}
        <ChevronDown size={11} strokeWidth={2.5} className="opacity-70" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-xl border border-[#e2e8f0] py-1 w-[160px] z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#706E6B] border-b border-[#f1f5f9]">
            Project Status
          </div>
          {HEALTH_OPTIONS.map(opt => {
            const oc = HEALTH_COLORS[opt]
            const active = opt === value
            return (
              <button
                key={opt}
                onClick={() => pick(opt)}
                className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 hover:bg-[#f8fafc] ${active ? 'bg-[#fafbfc]' : ''}`}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: oc.dot }} />
                <span className="text-[#181818]" style={{ fontWeight: active ? 600 : 400 }}>{opt}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
