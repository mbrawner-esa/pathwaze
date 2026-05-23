'use client'
import { X } from 'lucide-react'
import { ReactNode, useEffect } from 'react'

interface RowDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

export function RowDrawer({ open, onClose, title, subtitle, children, footer, width = 520 }: RowDrawerProps) {
  // Close on escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/30 z-40 transition-opacity" />
      <aside
        className="fixed top-0 right-0 h-full bg-white z-50 shadow-xl border-l border-[#e2e8f0] flex flex-col"
        style={{ width: `${width}px`, maxWidth: '95vw' }}
      >
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-[#181818] truncate">{title}</h3>
            {subtitle && <p className="text-[12px] text-[#706E6B] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#706E6B] flex-shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-[#f1f5f9] px-6 py-3.5 bg-[#fafbfc]">{footer}</div>}
      </aside>
    </>
  )
}

// ── Inline label/value pair for drawer content ────────────────────
export function DrawerField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">{label}</label>
      <div className="text-[13px] text-[#181818]">{children || '—'}</div>
    </div>
  )
}

// ── Drawer-friendly form input row ────────────────────────────────
export function DrawerInput({
  label, value, onChange, type = 'text', placeholder, required = false,
}: {
  label: string; value: string | number; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">
        {label} {required && <span className="text-[#dc2626]">*</span>}
      </label>
      <input
        type={type}
        value={value as string | number}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
      />
    </div>
  )
}

export function DrawerSelect({
  label, value, options, onChange, required = false,
}: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; required?: boolean
}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">
        {label} {required && <span className="text-[#dc2626]">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 bg-white"
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Card-style section wrapper for grouping drawer fields ────────
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-[#e2e8f0] bg-white overflow-hidden">
      <header className="px-3.5 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#3E3E3C]">{title}</h4>
      </header>
      <div className="px-3.5 pt-3 pb-1">{children}</div>
    </section>
  )
}

// Rich-text notes field. Uses RichTextEditor under the hood so Buildings /
// Permits / and any other table notes get the bold / bulleted / numbered
// toolbar consistent with task and pricing notes. Value is HTML; pair with
// NotesRender on the display side.
import { RichTextEditor } from '@/components/ui/RichTextEditor'

export function DrawerTextarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  // rows param kept for API compat; translates to a minHeight in pixels.
  const minHeight = Math.max(60, (rows ?? 3) * 24)
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">{label}</label>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    </div>
  )
}
