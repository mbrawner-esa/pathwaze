'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { RowDrawer, DrawerInput, DrawerSelect, DrawerTextarea, Section } from './_RowDrawer'

interface Permit {
  id: string
  project_id: string
  name: string             // permit type
  category: 'Ministerial' | 'Discretionary' | string
  level: string
  status: string
  ahj: string | null       // issuing authority
  permit_number: string | null
  inspector: string | null
  required: boolean
  stage: string | null
  est_cost: number | null
  est_review_days: number | null
  submitted_at: string | null
  approved_at: string | null
  expiry_date: string | null
  notes: string | null
}

const STATUSES = ['Not Started', 'Submitted', 'In Review', 'Approved', 'Denied', 'Expired']
const LEVELS = ['Local', 'State', 'Federal', 'Utility']
const CATEGORIES = ['Ministerial', 'Discretionary']
const STAGES = ['Pre-NTP', 'NTP', 'Pre-Construction', 'Post-Construction']

const STAGE_PILL: Record<string, { bg: string; text: string }> = {
  'Pre-NTP':           { bg: '#f1f5f9', text: '#475569' },
  'NTP':               { bg: '#eff6ff', text: '#1e40af' },
  'Pre-Construction':  { bg: '#fef3c7', text: '#92400e' },
  'Post-Construction': { bg: '#f0fdf4', text: '#166534' },
}

const PERMIT_TYPES = [
  // Discretionary (public hearing / board approval)
  'Conditional Use Permit',
  'Site Plan Approval',
  'Special Exception',
  'Zoning Variance',
  'Land Use Amendment',
  'Environmental Impact Review',
  // Ministerial (administrative / staff-level)
  'Building Permit',
  'Electrical Permit',
  'Mechanical Permit',
  'Stormwater / Erosion Control',
  'Fire Marshal Review',
  'ROW / Encroachment Permit',
  'Interconnection Agreement',
  'FAA Determination',
  'NPDES Permit',
  'Demolition Permit',
  'Sign Permit',
  'Tree Removal Permit',
  'Other',
]

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  'Not Started': { bg: '#f1f5f9', text: '#475569' },
  'Submitted':   { bg: '#eff6ff', text: '#1e40af' },
  'In Review':   { bg: '#fefce8', text: '#854d0e' },
  'Approved':    { bg: '#f0fdf4', text: '#166534' },
  'Denied':      { bg: '#fef2f2', text: '#991b1b' },
  'Expired':     { bg: '#fdf2f8', text: '#9d174d' },
}

const LEVEL_PILL: Record<string, { bg: string; text: string }> = {
  Local:   { bg: '#f0f3f6', text: '#4F6478' },
  State:   { bg: '#eff6ff', text: '#1e40af' },
  Federal: { bg: '#fef2f2', text: '#991b1b' },
  Utility: { bg: '#f5f3ff', text: '#6d28d9' },
}

export function PermittingTab({ project, permits }: { project: Record<string, unknown>; permits: Permit[] }) {
  const p = project as { id: string }
  const disc = permits.filter(x => x.category === 'Discretionary')
  const min  = permits.filter(x => x.category === 'Ministerial' || !x.category)

  return (
    <div className="space-y-5">
      <PermitSection
        title="Discretionary Permits"
        subtitle="Public hearing / board approval"
        projectId={p.id}
        defaultCategory="Discretionary"
        permits={disc}
      />
      <PermitSection
        title="Ministerial Permits"
        subtitle="Administrative / staff-level review"
        projectId={p.id}
        defaultCategory="Ministerial"
        permits={min}
      />
    </div>
  )
}

function PermitSection({
  title, subtitle, projectId, defaultCategory, permits,
}: {
  title: string
  subtitle: string
  projectId: string
  defaultCategory: 'Discretionary' | 'Ministerial'
  permits: Permit[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState<Permit | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const blank = {
    name: '', category: defaultCategory, level: 'Local', status: 'Not Started',
    ahj: '', permit_number: '', inspector: '', required: true, stage: '',
    est_cost: '', est_review_days: '',
    submitted_at: '', approved_at: '', expiry_date: '', notes: '',
  }
  const [form, setForm] = useState<typeof blank>(blank)

  function startNew() { setForm({ ...blank, category: defaultCategory }); setErr(null); setOpen('new') }
  function startEdit(pm: Permit) {
    setForm({
      name: pm.name,
      category: (pm.category as 'Ministerial' | 'Discretionary') || defaultCategory,
      level: pm.level || 'Local',
      status: pm.status || 'Not Started',
      ahj: pm.ahj ?? '',
      permit_number: pm.permit_number ?? '',
      inspector: pm.inspector ?? '',
      required: pm.required ?? true,
      stage: pm.stage ?? '',
      est_cost: pm.est_cost?.toString() ?? '',
      est_review_days: pm.est_review_days?.toString() ?? '',
      submitted_at: pm.submitted_at ? String(pm.submitted_at).slice(0, 10) : '',
      approved_at:  pm.approved_at  ? String(pm.approved_at).slice(0, 10)  : '',
      expiry_date:  pm.expiry_date  ? String(pm.expiry_date).slice(0, 10)  : '',
      notes: pm.notes ?? '',
    })
    setErr(null); setOpen(pm)
  }

  async function save() {
    if (!form.name.trim()) { setErr('Permit type is required.'); return }
    if (!form.ahj.trim())  { setErr('Issuing authority is required.'); return }
    setSaving(true); setErr(null)
    const isNew = open === 'new'
    const url = isNew ? '/api/permits' : `/api/permits/${(open as Permit).id}`
    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      level: form.level,
      status: form.status,
      ahj: form.ahj || null,
      permit_number: form.permit_number || null,
      inspector: form.inspector || null,
      required: form.required,
      stage: form.stage || null,
      est_cost: form.est_cost ? Number(form.est_cost) : null,
      est_review_days: form.est_review_days ? Number(form.est_review_days) : null,
      submitted_at: form.submitted_at || null,
      approved_at:  form.approved_at  || null,
      expiry_date:  form.expiry_date  || null,
      notes: form.notes || null,
    }
    if (isNew) payload.project_id = projectId
    try {
      const res = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  async function remove() {
    if (typeof open !== 'object' || !open) return
    if (!confirm(`Delete "${open.name}"?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/permits/${open.id}`, { method: 'DELETE' })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  const selected = typeof open === 'object' ? open : null
  const approved = permits.filter(x => x.status === 'Approved').length
  const total = permits.length
  const allApproved = total > 0 && approved === total
  const ratioBg   = allApproved ? '#f0f6ec' : (defaultCategory === 'Discretionary' ? '#fef3c7' : '#eff6ff')
  const ratioText = allApproved ? '#5e8a42' : (defaultCategory === 'Discretionary' ? '#92400e' : '#1e40af')

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-[14px] font-bold text-[#181818]">{title}</h3>
          <span className="text-[11px] text-[#94a3b8]">({total})</span>
          {total > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: ratioBg, color: ratioText }}>
              {approved}/{total} approved
            </span>
          )}
          <span className="text-[11.5px] text-[#706E6B]">· {subtitle}</span>
        </div>
        <button onClick={startNew} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add Permit</button>
      </div>

      {permits.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No {defaultCategory.toLowerCase()} permits yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Permit Type</th>
              <th className="text-left px-4 py-3 label">Stage</th>
              <th className="text-left px-4 py-3 label">Authority</th>
              <th className="text-left px-4 py-3 label">Level</th>
              <th className="text-left px-4 py-3 label">Permit #</th>
              <th className="text-left px-4 py-3 label">Status</th>
              <th className="text-left px-4 py-3 label">Submitted</th>
              <th className="text-left px-4 py-3 label">Approved</th>
            </tr>
          </thead>
          <tbody>
            {permits.map(pm => {
              const sp = STATUS_PILL[pm.status] ?? STATUS_PILL['Not Started']
              const lv = LEVEL_PILL[pm.level]    ?? LEVEL_PILL['Local']
              const st = pm.stage ? STAGE_PILL[pm.stage] : null
              return (
                <tr key={pm.id} onClick={() => startEdit(pm)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">
                    {pm.name}
                    {!pm.required && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">Optional</span>}
                  </td>
                  <td className="px-4 py-3">
                    {st ? <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: st.bg, color: st.text }}>{pm.stage}</span> : <span className="text-[#94a3b8]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{pm.ahj ?? '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: lv.bg, color: lv.text }}>{pm.level}</span></td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{pm.permit_number ?? '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sp.bg, color: sp.text }}>{pm.status}</span></td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{formatDate(pm.submitted_at)}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{formatDate(pm.approved_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <RowDrawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === 'new' ? `Add ${defaultCategory} Permit` : selected?.name || ''}
        subtitle={open === 'new' ? subtitle : `${selected?.category} · ${selected?.level}`}
        width={560}
        footer={
          <div className="flex items-center justify-between">
            {open !== 'new' && selected ? (
              <button onClick={remove} disabled={saving} className="text-[12px] text-[#dc2626] hover:underline inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={() => setOpen(null)} disabled={saving} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        }
      >
        <Section title="Identification">
          <DrawerSelect label="Permit Type" value={form.name} options={PERMIT_TYPES} onChange={v => setForm(f => ({ ...f, name: v }))} required />
          <DrawerInput label="Issuing Authority" value={form.ahj} onChange={v => setForm(f => ({ ...f, ahj: v }))} placeholder="e.g. Orange County Building Dept." required />
          <div className="grid grid-cols-2 gap-3">
            <DrawerSelect label="Category" value={form.category} options={CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v as 'Ministerial' | 'Discretionary' }))} />
            <DrawerSelect label="Level" value={form.level} options={LEVELS} onChange={v => setForm(f => ({ ...f, level: v }))} />
          </div>
        </Section>

        <Section title="Status">
          <div className="grid grid-cols-2 gap-3">
            <DrawerSelect label="Status" value={form.status} options={STATUSES} onChange={v => setForm(f => ({ ...f, status: v }))} />
            <DrawerSelect label="Stage" value={form.stage} options={STAGES} onChange={v => setForm(f => ({ ...f, stage: v }))} />
          </div>
          <DrawerInput label="Permit #" value={form.permit_number} onChange={v => setForm(f => ({ ...f, permit_number: v }))} placeholder="e.g. BP-2026-00123" />
          <DrawerInput label="Inspector / Reviewer" value={form.inspector} onChange={v => setForm(f => ({ ...f, inspector: v }))} placeholder="Reviewer name" />
          <label className="flex items-center gap-2 mt-1 mb-3 text-[12.5px] text-[#3E3E3C]">
            <input type="checkbox" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
            Required for this project
          </label>
        </Section>

        <Section title="Planning Estimates">
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput type="number" label="Estimated Cost ($)" value={form.est_cost} onChange={v => setForm(f => ({ ...f, est_cost: v }))} placeholder="e.g. 2500" />
            <DrawerInput type="number" label="Estimated Review Time (days)" value={form.est_review_days} onChange={v => setForm(f => ({ ...f, est_review_days: v }))} placeholder="e.g. 30" />
          </div>
        </Section>

        <Section title="Dates">
          <div className="grid grid-cols-3 gap-3">
            <DrawerInput type="date" label="Submitted" value={form.submitted_at} onChange={v => setForm(f => ({ ...f, submitted_at: v }))} />
            <DrawerInput type="date" label="Approved"  value={form.approved_at}  onChange={v => setForm(f => ({ ...f, approved_at: v }))} />
            <DrawerInput type="date" label="Expires"   value={form.expiry_date}  onChange={v => setForm(f => ({ ...f, expiry_date: v }))} />
          </div>
        </Section>

        <Section title="Notes">
          <DrawerTextarea label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
        </Section>

        {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      </RowDrawer>
    </div>
  )
}
