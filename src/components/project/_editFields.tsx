'use client'
import { Pencil, X, Check } from 'lucide-react'

// ── KV layout (option G) ────────────────────────────────────────────────
// Renders fields as 2-per-row key/value cells with muted label background
// and dividers. Use <FieldGrid> as the wrapper, <Field> for each row.

export function FieldGrid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 ${className}`}>
      {children}
    </div>
  )
}

export function Field({
  label,
  children,
  full = false,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  const colSpan = full ? 'col-span-2' : ''
  // Border strategy: every cell gets bottom border (rows). Odd-position cells
  // (left col in a 2-col grid) get right border, unless they span full width.
  const rightBorder = full
    ? ''
    : '[&:nth-child(odd)]:border-r [&:nth-child(odd)]:border-[#f1f5f9]'
  return (
    <div className={`grid grid-cols-[160px_1fr] border-b border-[#f1f5f9] ${colSpan} ${rightBorder}`}>
      <div className="px-4 py-2 bg-[#fafbfc] border-r border-[#f1f5f9] text-[12px] font-semibold text-[#3E3E3C] flex items-center min-h-[38px]">
        {label}
      </div>
      <div className="px-4 py-2 text-[13px] text-[#181818] flex items-center min-h-[38px]">
        {children}
      </div>
    </div>
  )
}

// Single inline input wrapper styled to fit within a Field cell
export function FieldInput({
  value, onChange, type = 'text', placeholder, suffix,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      <input
        type={type}
        value={value === null || value === undefined ? '' : value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 px-2 py-0.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
      />
      {suffix && <span className="text-[11.5px] text-[#706E6B] flex-shrink-0">{suffix}</span>}
    </div>
  )
}

export function FieldSelect({
  value, options, onChange, placeholder = '— Select —',
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-0.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ── Legacy ViewField (preserved during migration) ───────────────────────
export function ViewField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-sm text-[#181818]">
        {value !== null && value !== undefined && value !== '' ? value : '—'}
      </p>
    </div>
  )
}

export function EditInput({
  label, value, onChange, type = 'text', placeholder, suffix,
}: {
  label: string
  value: string | number
  onChange: (val: string) => void
  type?: 'text' | 'number' | 'date'
  placeholder?: string
  suffix?: string
}) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value === null || value === undefined ? '' : value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
        />
        {suffix && <span className="text-sm text-[#706E6B] flex-shrink-0">{suffix}</span>}
      </div>
    </div>
  )
}

export function EditSelect({
  label, value, options, onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (val: string) => void
}) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
      >
        <option value="">— Select —</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}

export function EditTextarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] resize-none focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
      />
    </div>
  )
}

export function EditToolbar({
  editMode, saving, onEdit, onCancel, onSave,
}: {
  editMode: boolean
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
}) {
  if (editMode) {
    return (
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={saving} className="btn-secondary">
          <X size={13} /> Cancel
        </button>
        <button onClick={onSave} disabled={saving} className="btn-primary">
          <Check size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    )
  }
  return (
    <button onClick={onEdit} className="btn-secondary">
      <Pencil size={13} /> Edit
    </button>
  )
}

export function ErrorBanner({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <div className="mt-4 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">
      {error}
    </div>
  )
}
