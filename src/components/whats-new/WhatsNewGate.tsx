'use client'
/**
 * WhatsNewGate — shows the release-note modal once per user, per release.
 *
 * Rendered from AppLayout, so it fires on whatever page the user lands on after
 * login. `seen` is the user's `whats_new_seen` column; when it doesn't match the
 * current RELEASE.key we show the modal, and either action (dismiss or "Read the
 * full update") stamps the key so it never fires again for that release.
 */
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { RELEASE } from '@/lib/whats-new'

export function WhatsNewGate({ seen }: { seen: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(seen !== RELEASE.key)

  // Already reading the full note — no point interrupting with a summary of it.
  if (!open || pathname === '/whats-new') return null

  async function markSeen() {
    setOpen(false)
    // Fire-and-forget: if this fails the modal simply returns next load, which
    // is the harmless direction to fail in.
    await fetch('/api/whats-new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: RELEASE.key }),
    }).catch(() => {})
  }

  async function readFull() {
    await markSeen()
    router.push('/whats-new')
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header — navy band, matching the nav */}
        <div className="relative px-6 py-5 bg-[#0F1B26]">
          <button
            onClick={markSeen}
            aria-label="Dismiss"
            className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} strokeWidth={2} />
          </button>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#E6C87A]">
            What&apos;s new in Pathwaze
          </p>
          <h2 className="text-[21px] font-bold text-white mt-1.5 leading-tight">{RELEASE.title}</h2>
          <p className="text-[12px] text-slate-400 mt-1">{RELEASE.window}</p>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          <p className="text-[13px] text-[#3E3E3C] leading-relaxed">{RELEASE.intro}</p>

          <ul className="mt-4 space-y-2.5">
            {RELEASE.sections.map(s => (
              <li key={s.id} className="flex items-start gap-3">
                <span className="text-[15px] leading-none mt-0.5 w-5 shrink-0 text-center">{s.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#080707] leading-snug">{s.title}</p>
                  <p className="text-[12.5px] text-[#706E6B] leading-snug mt-0.5">{s.summary}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 pt-4 border-t border-[#ECEBEA]">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#706E6B]">Coming next</p>
            <p className="text-[12.5px] text-[#3E3E3C] leading-relaxed mt-1.5">
              {RELEASE.next.map(n => n.title).join(' · ')}
            </p>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE] flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[#94a3b8]">
            Find this again under your avatar menu.
          </span>
          <div className="flex gap-2">
            <button onClick={markSeen} className="btn-secondary">Dismiss</button>
            <button onClick={readFull} className="btn-primary">Read the full update</button>
          </div>
        </div>
      </div>
    </div>
  )
}
