'use client'
/**
 * FilterPresets — save/apply named filter presets for a list page.
 *
 * The parent owns its filter state; it passes the current filter values as an
 * opaque `current` object and an `onApply` callback that restores a saved blob.
 * Presets are per-user, persisted via /api/saved-filters (scope = 'projects' | 'tasks').
 *
 *   <FilterPresets scope="projects" current={{ search, stageFilter, ... }} onApply={applyFilters} />
 */
import { useEffect, useState, useCallback } from 'react'
import { Bookmark, Plus, X } from 'lucide-react'
import { usePrompt } from './usePrompt'

interface Preset { id: string; name: string; filters: Record<string, unknown> }

export function FilterPresets({
  scope, current, onApply,
}: {
  scope: 'projects' | 'tasks'
  current: Record<string, unknown>
  onApply: (filters: Record<string, unknown>) => void
}) {
  const [presets, setPresets] = useState<Preset[]>([])
  const [saving, setSaving] = useState(false)
  const { prompt, dialog } = usePrompt()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/saved-filters?scope=${scope}`)
      if (res.ok) setPresets(await res.json())
    } catch { /* ignore */ }
  }, [scope])

  useEffect(() => { load() }, [load])

  async function saveCurrent() {
    const name = (await prompt({ title: 'Save filter preset', label: 'Preset name', placeholder: 'e.g. FL · Active · mine', required: true, confirmLabel: 'Save' }))?.trim()
    if (!name) return
    setSaving(true)
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, name, filters: current }),
      })
      if (res.ok) { const p = await res.json(); setPresets(prev => [...prev, p].sort((a, b) => a.name.localeCompare(b.name))) }
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    setPresets(prev => prev.filter(p => p.id !== id))   // optimistic
    await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {dialog}
      {presets.map(p => (
        <span key={p.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-[#EFF4FA] border border-[#bfdbfe] rounded-full text-[12px] text-[#2C5485]">
          <button type="button" onClick={() => onApply(p.filters)} className="inline-flex items-center gap-1 font-medium hover:underline" title="Apply this preset">
            <Bookmark size={11} /> {p.name}
          </button>
          <button type="button" onClick={() => remove(p.id)} className="p-0.5 hover:bg-[#dbeafe] rounded-full" title="Delete preset">
            <X size={11} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={saveCurrent}
        disabled={saving}
        className="inline-flex items-center gap-1 px-2 py-1 text-[12px] font-semibold text-[#3E3E3C] border border-[#DDDBDA] rounded-full hover:bg-[#F3F2F2] disabled:opacity-50"
        title="Save the current filters as a preset"
      >
        <Plus size={11} /> Save filter
      </button>
    </div>
  )
}
