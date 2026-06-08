'use client'
import { useRef, useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Upload, FileText, ChevronRight, Trash2, Plus } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────
export interface PlanSection { key: string; label: string; is_universal: boolean; item_count: number }
export interface Owner { id: string; full_name: string; avatar_url?: string | null }
export interface Collection {
  id: string
  name: string
  owner_id: string | null
  owner?: Owner | null
  action_plan_id: string | null
  sections: PlanSection[]
}
export interface Area { id: string; name: string; category: string }
export interface Drawing {
  id: string
  project_id: string
  collection_id: string | null
  area_id: string | null
  drawing_type: string
  discipline_key: string | null
  file_name: string
  set_label: string | null
  uploaded_at: string
  review?: { id: string; status: string } | { id: string; status: string }[] | null
}
export interface SimpleUser { id: string; full_name: string; avatar_url?: string | null }
export interface ReviewType { id: string; name: string }

interface Props {
  projectId: string
  drawings: Drawing[]
  areas: Area[]
  collections: Collection[]
  users: SimpleUser[]
  reviewTypes: ReviewType[]
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

const reviewOf = (d: Drawing) => (Array.isArray(d.review) ? (d.review[0] ?? null) : d.review) || null
const initials = (n?: string) => (n ?? '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
const isReviewed = (d: Drawing) => ['complete', 'under_review'].includes(reviewOf(d)?.status ?? '')

function Avatar({ user, size = 22 }: { user?: Owner | null; size?: number }) {
  if (!user) return <span className="text-[#A8A8A8] text-[12px]">—</span>
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-[#70A0D0] text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.4 }} title={user.full_name}>
      {initials(user.full_name)}
    </span>
  )
}

export function DrawingsTab({ projectId, drawings: initial, areas, collections: initialCollections, users, reviewTypes }: Props) {
  const [collections, setCollections] = useState<Collection[]>(initialCollections)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>(initial)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const active = collections.find(c => c.id === activeId) ?? null

  // ── Upload (into the active collection) ────────────────────────────
  async function onPickFiles(files: FileList | null) {
    if (!files?.length || !active) return
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
            project_id: projectId, collection_id: active.id, file_name: file.name,
            storage_path: path, file_size: file.size, content_type: file.type,
          }),
        })
        if (res.ok) { const row = await res.json(); setDrawings(prev => [row, ...prev]) }
        else {
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

  async function linkDrawing(id: string, area_id: string, discipline_key: string | null) {
    const res = await fetch(`/api/drawings/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ area_id, discipline_key }),
    })
    if (res.ok) { const row = await res.json(); setDrawings(prev => prev.map(d => (d.id === id ? row : d))) }
    else { const b = await res.json().catch(() => ({})); setError(b?.error || 'Failed to link drawing') }
  }

  async function removeDrawing(id: string) {
    if (!confirm('Remove this drawing and its review?')) return
    if ((await fetch(`/api/drawings/${id}`, { method: 'DELETE' })).ok) setDrawings(prev => prev.filter(d => d.id !== id))
  }

  function openReview(d: Drawing) {
    if (reviewOf(d)) alert('The drawing review checklist opens here — coming in the next phase (P3).')
  }

  // ── Landing: collections ───────────────────────────────────────────
  if (!active) {
    return <Landing
      collections={collections} drawings={drawings} areas={areas} users={users} reviewTypes={reviewTypes}
      onOpen={setActiveId}
      onCreate={c => setCollections(prev => {
        // Inherit sections from a sibling collection that uses the same review type (action plan),
        // so a freshly created collection is reviewable immediately this session.
        const sections = c.action_plan_id ? (prev.find(x => x.action_plan_id === c.action_plan_id)?.sections ?? []) : []
        return [...prev, { ...c, sections }]
      })}
    />
  }

  // ── Collection view ────────────────────────────────────────────────
  const disciplines = active.sections.filter(s => !s.is_universal)
  const hasDisc = disciplines.length > 0
  const universalCount = active.sections.find(s => s.is_universal)?.item_count ?? 0
  const disciplineLabel = (k: string | null) => (k ? active.sections.find(s => s.key === k)?.label ?? k : null)
  const scopeCount = (k: string | null) => universalCount + (k ? active.sections.find(s => s.key === k)?.item_count ?? 0 : 0)

  const inCollection = drawings.filter(d => d.collection_id === active.id)
  const needsLinking = inCollection.filter(d => !d.area_id || (hasDisc && !d.discipline_key))
  const linked = inCollection.filter(d => d.area_id && (!hasDisc || d.discipline_key))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="text-[13px] text-[#706E6B] flex items-center gap-2">
          <button onClick={() => setActiveId(null)} className="text-[#70A0D0] font-semibold hover:underline">Drawings</button>
          <ChevronRight size={13} /> <b className="text-[#080707] text-[16px] font-bold">{active.name}</b>
          {active.owner && <span className="ml-1 inline-flex items-center gap-1.5 text-[12px] text-[#706E6B]"><Avatar user={active.owner} size={18} /> {active.owner.full_name}</span>}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInput} type="file" multiple className="hidden" onChange={e => onPickFiles(e.target.files)} />
          <button className="btn-primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload drawings'}
          </button>
        </div>
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{error}</div>}
      {!active.action_plan_id && (
        <div className="mb-3 px-3 py-2 bg-[#FFFBEB] border border-[#FCD9A0] rounded text-[12px] text-[#92400e]">
          This collection has no review checklist (action plan) yet. Drawings can be uploaded and organized; the review will activate once a checklist is attached.
        </div>
      )}

      {needsLinking.length > 0 && (
        <div className="card mb-[18px] overflow-hidden">
          <div className="px-[18px] py-3 border-b border-[#ECEBEA] bg-[#FBFCFE]">
            <h4 className="text-[13px] font-bold text-[#080707]">{needsLinking.length} drawing{needsLinking.length === 1 ? '' : 's'} need an area{hasDisc ? ' + discipline' : ''}</h4>
            <p className="text-[11.5px] text-[#706E6B] mt-0.5">Assign each to an area{hasDisc ? ' and tag its discipline — that creates its review' : ''}.</p>
          </div>
          {needsLinking.map(d => (
            <LinkRow key={d.id} d={d} areas={areas} disciplines={disciplines} hasDisc={hasDisc} onLink={linkDrawing} onRemove={removeDrawing} />
          ))}
        </div>
      )}

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
              <span className="text-[12px] text-[#706E6B]">{inArea.filter(isReviewed).length} / {inArea.length} reviewed</span>
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
                      {hasDisc && d.discipline_key && <>
                        <span className="text-[9.5px] font-bold px-[7px] py-0.5 rounded border border-[#DDDBDA] bg-[#eef2f6] text-[#3E3E3C]">{disciplineLabel(d.discipline_key)}</span>
                        <span className="text-[10.5px] text-[#706E6B] font-semibold">Universal + {disciplineLabel(d.discipline_key)} ({scopeCount(d.discipline_key)})</span>
                      </>}
                    </div>
                    <div className="text-[11.5px] text-[#706E6B] mt-0.5">{d.set_label ? d.set_label + ' · ' : ''}{new Date(d.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  {rev ? <>
                    {rev.status === 'not_started' && <span className="text-[9.5px] font-extrabold uppercase text-[#b91c1c] bg-[#FEF2F2] border border-[#fecaca] rounded px-[7px] py-0.5">Needs review</span>}
                    <span className="text-[10px] font-bold px-[9px] py-[3px] rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
                    <button className="btn-secondary" onClick={() => openReview(d)}>{rev.status === 'not_started' ? 'Start review' : 'Review'} <ChevronRight size={12} /></button>
                  </> : <span className="text-[11px] text-[#A8A8A8]">No checklist</span>}
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

// ── Landing ─────────────────────────────────────────────────────────────
function Landing({ collections, drawings, areas, users, reviewTypes, onOpen, onCreate }: {
  collections: Collection[]; drawings: Drawing[]; areas: Area[]; users: SimpleUser[]; reviewTypes: ReviewType[]
  onOpen: (id: string) => void; onCreate: (c: Collection) => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [reviewTypeId, setReviewTypeId] = useState(reviewTypes.length === 1 ? reviewTypes[0].id : '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    setSaving(true); setErr(null)
    const res = await fetch('/api/drawing-collections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), owner_id: ownerId || null, action_plan_id: reviewTypeId || null }),
    })
    setSaving(false)
    if (res.ok) {
      onCreate(await res.json())
      setCreating(false); setName(''); setOwnerId(''); setReviewTypeId(reviewTypes.length === 1 ? reviewTypes[0].id : '')
    } else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Failed to create') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[17px] font-bold text-[#080707]">Drawings</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {collections.map(c => {
          const inC = drawings.filter(d => d.collection_id === c.id)
          const reviewed = inC.filter(isReviewed).length
          return (
            <button key={c.id} onClick={() => onOpen(c.id)}
              className="card p-[18px] text-left hover:shadow-md transition-shadow flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15.5px] font-bold text-[#080707]">{c.name}</div>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#706E6B] shrink-0">
                  <Avatar user={c.owner} size={20} />
                </span>
              </div>
              <div className="border-t border-[#ECEBEA] pt-[11px] text-[12px] text-[#3E3E3C]">
                {inC.length} drawing{inC.length === 1 ? '' : 's'} · {reviewed} reviewed · {areas.length} area{areas.length === 1 ? '' : 's'}
              </div>
              <div className="text-[11.5px] text-[#706E6B]">Owner: {c.owner?.full_name ?? 'Unassigned'}</div>
              <div className="text-[12px] font-bold text-[#70A0D0]">Open →</div>
            </button>
          )
        })}

        {/* Add drawing type / collection */}
        {creating ? (
          <div className="card p-[18px] flex flex-col gap-2.5 border border-[#70A0D0]">
            <div className="text-[13px] font-bold text-[#080707]">New drawing type</div>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Solar PV Design)"
              className="border border-[#DDDBDA] rounded-md px-2.5 py-1.5 text-[13px]" />
            <select value={reviewTypeId} onChange={e => setReviewTypeId(e.target.value)}
              className="border border-[#DDDBDA] rounded-md px-2.5 py-1.5 text-[13px]">
              <option value="">Select review type…</option>
              {reviewTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
            </select>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)}
              className="border border-[#DDDBDA] rounded-md px-2.5 py-1.5 text-[13px]">
              <option value="">Owner (optional)…</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            {err && <div className="text-[11.5px] text-[#b91c1c]">{err}</div>}
            <div className="flex gap-2 mt-1">
              <button className="btn-primary" disabled={saving || !name.trim()} onClick={create}>{saving ? 'Creating…' : 'Create'}</button>
              <button className="btn-secondary" onClick={() => { setCreating(false); setErr(null) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="rounded-[12px] border-2 border-dashed border-[#DDDBDA] p-[18px] flex flex-col items-center justify-center gap-2 text-[#706E6B] hover:border-[#70A0D0] hover:text-[#70A0D0] transition-colors min-h-[150px]">
            <Plus size={22} />
            <span className="text-[13px] font-bold">Add drawing type</span>
            <span className="text-[11px] text-center">A named collection with an owner (e.g. PV Design, Permit Sets)</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Needs-linking row ──────────────────────────────────────────────────
function LinkRow({ d, areas, disciplines, hasDisc, onLink, onRemove }: {
  d: Drawing; areas: Area[]; disciplines: PlanSection[]; hasDisc: boolean
  onLink: (id: string, area: string, disc: string | null) => void
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
      {hasDisc && (
        <select value={disc} onChange={e => setDisc(e.target.value)} className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px]">
          <option value="">Discipline…</option>
          {disciplines.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      )}
      <button className="btn-secondary" disabled={!area || (hasDisc && !disc)} onClick={() => onLink(d.id, area, hasDisc ? disc : null)}>
        {hasDisc ? 'Create review' : 'Link'}
      </button>
      <button className="text-[#A8A8A8] hover:text-[#b91c1c] p-1" onClick={() => onRemove(d.id)} title="Remove"><Trash2 size={14} /></button>
    </div>
  )
}
