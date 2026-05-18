'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { RowDrawer, DrawerInput, DrawerSelect, Section } from './_RowDrawer'

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  'Supportive': { bg: '#F0FDF4', text: '#166534' },
  'Neutral':    { bg: '#F8FAFC', text: '#475569' },
  'Concerned':  { bg: '#FFFBEB', text: '#92400e' },
  'Opposed':    { bg: '#FEF2F2', text: '#991b1b' },
}

const SENTIMENTS = ['Supportive', 'Neutral', 'Concerned', 'Opposed']
const ROLES = ['Decision Maker', 'Influencer', 'Evaluator', 'Champion', 'End User', 'Technical', 'Financial', 'Legal']

interface Stakeholder {
  id: string
  name: string
  title: string
  department: string
  role: string
  email: string
  phone: string
  sentiment: string
  is_primary: boolean
  org: string
}

export function StakeholdersTab({ stakeholders, projectId }: { stakeholders: Stakeholder[]; projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState<Stakeholder | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const blank = {
    name: '', title: '', org: '', department: '', role: 'Evaluator',
    email: '', phone: '', sentiment: 'Neutral', is_primary: false,
  }
  const [form, setForm] = useState(blank)

  function startNew() { setForm(blank); setErr(null); setOpen('new') }
  function startEdit(s: Stakeholder) {
    setForm({
      name: s.name ?? '', title: s.title ?? '', org: s.org ?? '', department: s.department ?? '',
      role: s.role || 'Evaluator', email: s.email ?? '', phone: s.phone ?? '',
      sentiment: s.sentiment || 'Neutral', is_primary: !!s.is_primary,
    })
    setErr(null); setOpen(s)
  }

  async function save() {
    if (!form.name.trim()) { setErr('Name is required.'); return }
    setSaving(true); setErr(null)
    const isNew = open === 'new'
    const url = isNew ? '/api/stakeholders' : `/api/stakeholders/${(open as Stakeholder).id}`
    const payload = isNew ? { project_id: projectId, ...form } : form
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
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
      const res = await fetch(`/api/stakeholders/${open.id}`, { method: 'DELETE' })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  const selected = typeof open === 'object' ? open : null

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">Stakeholders</h3>
        <button onClick={startNew} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add Stakeholder</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
            <th className="text-left px-4 py-3 label">Name</th>
            <th className="text-left px-4 py-3 label">Title</th>
            <th className="text-left px-4 py-3 label">Role</th>
            <th className="text-left px-4 py-3 label">Department</th>
            <th className="text-left px-4 py-3 label">Sentiment</th>
            <th className="text-left px-4 py-3 label">Email</th>
          </tr>
        </thead>
        <tbody>
          {stakeholders.map(s => {
            const sentColors = SENTIMENT_COLORS[s.sentiment] ?? { bg: '#F8FAFC', text: '#475569' }
            return (
              <tr key={s.id} onClick={() => startEdit(s)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#181818]">{s.name}</span>
                    {s.is_primary && (
                      <span className="text-[10px] font-bold tracking-wide bg-[#E6C87A22] text-[#b8963a] px-1.5 py-0.5 rounded">PRIMARY</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#3E3E3C]">{s.title}</td>
                <td className="px-4 py-3 text-[#3E3E3C]">{s.role}</td>
                <td className="px-4 py-3 text-[#3E3E3C]">{s.department}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sentColors.bg, color: sentColors.text }}>
                    {s.sentiment}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#3E3E3C]">
                  {s.email && s.email !== 'TBD' ? (
                    <a href={`mailto:${s.email}`} className="hover:text-[#181818]">{s.email}</a>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
          {!stakeholders.length && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[#706E6B]">No stakeholders yet</td>
            </tr>
          )}
        </tbody>
      </table>

      <RowDrawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === 'new' ? 'Add Stakeholder' : selected?.name || ''}
        subtitle={open === 'new' ? 'New project contact' : (selected?.title || selected?.role || 'Stakeholder')}
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
        <Section title="Identity">
          <DrawerInput label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Full name" required />
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput label="Title" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Director of Facilities" />
            <DrawerInput label="Organization" value={form.org} onChange={v => setForm(f => ({ ...f, org: v }))} placeholder="e.g. AdventHealth" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput label="Department" value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))} />
            <DrawerSelect label="Role" value={form.role} options={ROLES} onChange={v => setForm(f => ({ ...f, role: v }))} />
          </div>
        </Section>

        <Section title="Contact">
          <DrawerInput label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="name@org.com" />
          <DrawerInput label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        </Section>

        <Section title="Status">
          <DrawerSelect label="Sentiment" value={form.sentiment} options={SENTIMENTS} onChange={v => setForm(f => ({ ...f, sentiment: v }))} />
          <label className="flex items-center gap-2 mt-1 mb-3 text-[12.5px] text-[#3E3E3C]">
            <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded" />
            Primary contact for this project
          </label>
        </Section>

        {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      </RowDrawer>
    </div>
  )
}
