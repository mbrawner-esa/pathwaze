'use client'
import { useMemo, useRef, useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Upload, FileText, ChevronRight, Trash2 } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────
export interface PlanSection { key: string; label: string; is_universal: boolean; item_count: number }
export interface Area { id: string; name: string; category: string }
export interface Drawing {
  id: string
  project_id: string
  area_id: string | null
  drawing_type: string
  discipline_key: string | null
  file_name: string
  set_label: string | null
  uploaded_at: string
  area?: { id: string; name: string; category: string } | null
  review?: { id: string; status: string } | { id: string; status: string }[] | null
}

interface Props {
  projectId: string
  drawings: Drawing[]
  areas: Area[]
  planSections: PlanSection[]
}

const CATEGORY_PILL: Record<string, { bg: string; text: string }> = {
  'Building':    { bg: '#eff6ff', text: '#1e40af' },
  'Parking Lot': { bg: '#fef3c7', text: '#92400e' },
  'Garage':      { bg: '#f3e8ff', text: '#6b21a8' },
  'Field':       { bg: '#dcfce7', text: '#166534' },
  'Other':       { bg: '#f1f5f9', text: '#475569' },
}
const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  not_started:  { bg: '#FEF2F2', text: '#b91c1c', label: 'Not started' },
  in_progress:  { bg: '#FFFBEB', text: '#92400e', label: 'In Progress' },
  under_review: { bg: '#FDF4FF', text: '#7e22ce', label: 'Under Review' },
  complete:     { bg: '#F0FDF4', text: '#166534', label: 'Complete' },
}

function reviewOf(d: Drawing): { id: string; status: string } | null {
  if (!d.review) return null
  return Array.isArray(d.review) ? (d.review[0] ?? null) : d.review
}

export function DrawingsTab({ projectId, drawings: initial, areas, planSections }: Props) {
  const [view, setView] = useState<'landing' | 'asbuilt'>('landing')
  const [drawings, setDrawings] = useState<Drawing[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const disciplines = useMemo(() => planSections.filter(s => !s.is_universal), [planSections])
  const universalCount = useMemo(
    () => planSections.find(s => s.is_universal)?.item_count ?? 0, [planSections])
  const sectionCount = (key: string | null) =>
    key ? (planSections.find(s => s.key === key)?.item_count ?? 0) : 0
  const scopeCount = (key: string | null) => universalCount + sectionCount(key)
  const disciplineLabel = (key: string | null) =>
    key ? (planSections.find(s => s.key === key)?.label ?? key) : null

  const linked = drawings.filter(d => d.area_id && d.discipline_key)
  const needsLinking = drawings.filter(d => !d.area_id || !d.discipline_key)
  const reviewedCount = linked.filter(d => reviewOf(d)?.status === 'complete' || reviewOf(d)?.status === 'under_review').length

  // ── Upload ─────────────────────────────────────────────────────────
  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true); setError(null)
    const sb = createBrowserClient()
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_')
        const path = `${projectId}/${Date.now()}-${safe}`
        const { error: upErr } = await sb.storage.from('drawings').upload(path, file, { upsert: false })
        if (upErr) { setError(`Upload failed: ${upErr.message}`); continue }
        const res = await fetch('/api/drawings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId, file_name: file.name, storage_path: path,
            file_size: file.size, content_type: file.type,
          }),
        })
        if (res.ok) {
          const row = await res.json()
          setDrawings(prev => [row, ...prev])
        } else {
          const b = await res.json().catch(() => ({}))
          setError(b?.error || 'Failed to save drawing')
          try { await sb.storage.from('drawings').remove([path]) } catch { /* ignore */ }
        }
      }
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function linkDrawing(id: string, area_id: string, discipline_key: string) {
    const res = await fetch(`/api/drawings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area_id, discipline_key }),
    })
    if (res.ok) {
      const row = await res.json()
      setDrawings(prev => prev.map(d => (d.id === id ? row : d)))
    } else {
      const b = await res.json().catch(() => ({}))
      setError(b?.error || 'Failed to link drawing')
    }
  }

  async function removeDrawing(id: string) {
    if (!confirm('Remove this drawing and its review?')) return
    const res = await fetch(`/api/drawings/${id}`, { method: 'DELETE' })
    if (res.ok) setDrawings(prev => prev.filter(d => d.id !== id))
  }

  function openReview(d: Drawing) {
    // P3 will open the per-drawing review checklist here. Stubbed for now.
    const rev = reviewOf(d)
    if (rev) alert('The drawing review checklist opens here — coming in the next phase (P3).')
  }

  const uploadBtn = (
    <>
      <input ref={fileInput} type="file" multiple className="hidden"
        onChange={e => onPickFiles(e.target.files)} />
      <button className="btn-primary" disabled={uploading}
        onClick={() => fileInput.current?.click()}>
        <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload drawings'}
      </button>
    </>
  )

  // ── Landing: drawing-type boxes ────────────────────────────────────
  if (view === 'landing') {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[17px] font-bold text-[#080707]">Drawings</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={() => setView('asbuilt')}
            className="card p-[18px] text-left hover:shadow-md transition-shadow flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-[42px] h-[42px] rounded-[10px] bg-[#EFF4FA] text-[#70A0D0] flex items-center justify-center text-[20px]">📐</div>
              <div>
                <div className="text-[15.5px] font-bold text-[#080707]">As-Builts</div>
                <div className="text-[11.5px] text-[#706E6B] mt-0.5 leading-snug">Existing-building drawings — every drawing reviewed against the As-Built action plan.</div>
              </div>
            </div>
            <div className="border-t border-[#ECEBEA] pt-[11px] text-[12px] text-[#3E3E3C]">
              {drawings.length} drawing{drawings.length === 1 ? '' : 's'} · {reviewedCount} reviewed · {areas.length} area{areas.length === 1 ? '' : 's'}
            </div>
            <div className="text-[12px] font-bold text-[#70A0D0]">Open As-Builts →</div>
          </button>

          {[['☀️', 'Solar PV Design', 'Future: PV design drawings, reviewed against a design-QA action plan.'],
            ['🗂️', 'Permit Sets', 'Future: AHJ permit drawing packages and their review checklist.']].map(([ic, t, d]) => (
            <div key={t} className="card p-[18px] opacity-60 flex flex-col gap-3 bg-[#FBFCFE]">
              <div className="flex items-start gap-3">
                <div className="w-[42px] h-[42px] rounded-[10px] bg-[#EFF4FA] text-[#70A0D0] flex items-center justify-center text-[20px]">{ic}</div>
                <div>
                  <div className="text-[15.5px] font-bold text-[#080707]">{t}</div>
                  <div className="text-[11.5px] text-[#706E6B] mt-0.5 leading-snug">{d}</div>
                </div>
              </div>
              <span className="text-[9.5px] font-extrabold tracking-wide uppercase text-[#706E6B] bg-[#F3F2F2] rounded px-2 py-0.5 self-start">Coming soon</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── As-Built view ──────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-[13px] text-[#706E6B] flex items-center gap-2">
          <button onClick={() => setView('landing')} className="text-[#70A0D0] font-semibold hover:underline">Drawings</button>
          <ChevronRight size={13} /> <b className="text-[#080707] text-[16px] font-bold">As-Builts</b>
        </div>
        {uploadBtn}
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{error}</div>}

      {/* slim summary */}
      <div className="card px-4 py-3 mb-[18px] flex items-center gap-0 flex-wrap text-[12.5px] text-[#3E3E3C]">
        <span className="pr-4"><b className="text-[16px] font-extrabold text-[#080707]">{linked.length}</b> linked drawing{linked.length === 1 ? '' : 's'}</span>
        <span className="px-4 border-l border-[#ECEBEA]">{reviewedCount} reviewed</span>
        <span className="px-4 border-l border-[#ECEBEA]">{areas.length} area{areas.length === 1 ? '' : 's'}</span>
        {needsLinking.length > 0 && <span className="px-4 border-l border-[#ECEBEA] text-[#b91c1c] font-semibold">{needsLinking.length} need an area</span>}
      </div>

      {/* needs linking */}
      {needsLinking.length > 0 && (
        <div className="card mb-[18px] overflow-hidden">
          <div className="px-[18px] py-3 border-b border-[#ECEBEA] bg-[#FBFCFE]">
            <h4 className="text-[13px] font-bold text-[#080707]">{needsLinking.length} drawing{needsLinking.length === 1 ? '' : 's'} need an area</h4>
            <p className="text-[11.5px] text-[#706E6B] mt-0.5">Assign each to an area and tag its discipline — that creates its review.</p>
          </div>
          {needsLinking.map(d => <LinkRow key={d.id} d={d} areas={areas} disciplines={disciplines} onLink={linkDrawing} onRemove={removeDrawing} />)}
        </div>
      )}

      {/* areas */}
      {areas.length === 0 && (
        <div className="card p-6 text-center text-[12.5px] text-[#A8A8A8]">
          No areas yet. Add buildings/areas under the <b>Site</b> tab first, then upload drawings here.
        </div>
      )}
      {areas.map(area => {
        const inArea = linked.filter(d => d.area_id === area.id)
        const pill = CATEGORY_PILL[area.category] ?? CATEGORY_PILL['Other']
        return (
          <div key={area.id} className="card mb-[14px] overflow-hidden">
            <div className="px-[18px] py-3 border-b border-[#ECEBEA] bg-[#FBFCFE] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <span className="font-bold text-[#080707] text-[14.5px]">{area.name}</span>
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded" style={{ background: pill.bg, color: pill.text }}>{area.category}</span>
              </div>
              <span className="text-[12px] text-[#706E6B]">{inArea.filter(d => reviewOf(d)?.status === 'complete' || reviewOf(d)?.status === 'under_review').length} / {inArea.length} reviewed</span>
            </div>
            {inArea.length === 0 ? (
              <div className="px-[18px] py-4 text-center text-[12.5px] text-[#A8A8A8]">No drawings linked to this area yet.</div>
            ) : inArea.map(d => {
              const rev = reviewOf(d)
              const st = STATUS_PILL[rev?.status ?? 'not_started']
              return (
                <div key={d.id} className="flex items-center gap-3 px-[18px] py-3 border-b border-[#ECEBEA] last:border-b-0 hover:bg-[#FBFCFE]">
                  <FileText size={20} className="text-[#b91c1c] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold text-[#181818] flex items-center gap-2 flex-wrap">
                      {d.file_name}
                      <span className="text-[9.5px] font-bold px-[7px] py-0.5 rounded border border-[#DDDBDA] bg-[#eef2f6] text-[#3E3E3C]">{disciplineLabel(d.discipline_key)}</span>
                      <span className="text-[10.5px] text-[#706E6B] font-semibold">As-Built plan · Universal + {disciplineLabel(d.discipline_key)} ({scopeCount(d.discipline_key)})</span>
                    </div>
                    <div className="text-[11.5px] text-[#706E6B] mt-0.5">{d.set_label ? d.set_label + ' · ' : ''}{new Date(d.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  {rev?.status === 'not_started' && <span className="text-[9.5px] font-extrabold uppercase text-[#b91c1c] bg-[#FEF2F2] border border-[#fecaca] rounded px-[7px] py-0.5">Needs review</span>}
                  <span className="text-[10px] font-bold px-[9px] py-[3px] rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                  <button className="btn-secondary" onClick={() => openReview(d)}>
                    {rev?.status === 'not_started' ? 'Start review' : 'Review'} <ChevronRight size={12} />
                  </button>
                  <button className="text-[#A8A8A8] hover:text-[#b91c1c] p-1" onClick={() => removeDrawing(d.id)} title="Remove"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── Needs-linking row ──────────────────────────────────────────────────
function LinkRow({ d, areas, disciplines, onLink, onRemove }: {
  d: Drawing; areas: Area[]; disciplines: PlanSection[]
  onLink: (id: string, area: string, disc: string) => void
  onRemove: (id: string) => void
}) {
  const [area, setArea] = useState(d.area_id ?? '')
  const [disc, setDisc] = useState(d.discipline_key ?? '')
  return (
    <div className="flex items-center gap-[10px] px-[18px] py-[11px] border-b border-[#ECEBEA] last:border-b-0">
      <FileText size={18} className="text-[#b91c1c] shrink-0" />
      <span className="flex-1 min-w-0 text-[13px] font-semibold text-[#181818] truncate">{d.file_name}</span>
      <select value={area} onChange={e => setArea(e.target.value)} className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px]">
        <option value="">Assign area…</option>
        {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <select value={disc} onChange={e => setDisc(e.target.value)} className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px]">
        <option value="">Discipline…</option>
        {disciplines.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <button className="btn-secondary" disabled={!area || !disc} onClick={() => onLink(d.id, area, disc)}>Create review</button>
      <button className="text-[#A8A8A8] hover:text-[#b91c1c] p-1" onClick={() => onRemove(d.id)} title="Remove"><Trash2 size={14} /></button>
    </div>
  )
}
