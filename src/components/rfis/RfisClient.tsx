'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReceivedFromPicker } from './ReceivedFromPicker'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  open:   { bg: '#EFF6FF', text: '#1d4ed8', label: 'Open' },
  draft:  { bg: '#FFFBEB', text: '#92400e', label: 'Draft' },
  closed: { bg: '#F0FDF4', text: '#166534', label: 'Closed' },
}
const TABS = ['All', 'Open', 'Overdue', 'Draft', 'Closed'] as const
const rfiNo = (n: number) => '#' + String(n ?? 0).padStart(3, '0')

function ballName(r: Any): string {
  return r.ball_user?.full_name || r.ball_sh?.name || '—'
}
function daysOpen(r: Any): number | null {
  if (!r.date_initiated) return null
  const end = r.closed_at ? new Date(r.closed_at) : new Date()
  return Math.max(0, Math.round((end.getTime() - new Date(r.date_initiated).getTime()) / 86400000))
}
function isOverdue(r: Any): boolean {
  return r.status === 'open' && !!r.due_date && new Date(r.due_date) < new Date()
}

export function RfisClient({ rfis: initial, projects, users, stakeholders }: { rfis: Any[]; projects: Any[]; users: Any[]; stakeholders: Any[] }) {
  const router = useRouter()
  const [rfis, setRfis] = useState<Any[]>(initial)
  const [tab, setTab] = useState<typeof TABS[number]>('All')
  const [projectFilter, setProjectFilter] = useState('')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => rfis.filter(r => {
    if (tab === 'Open' && r.status !== 'open') return false
    if (tab === 'Draft' && r.status !== 'draft') return false
    if (tab === 'Closed' && r.status !== 'closed') return false
    if (tab === 'Overdue' && !isOverdue(r)) return false
    if (projectFilter && r.project_id !== projectFilter) return false
    if (search && !`${r.subject} ${r.rfi_number}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [rfis, tab, projectFilter, search])

  return (
    <div className="max-w-[1760px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#080707]">RFIs</h1>
          <div className="text-[12.5px] text-[#706E6B] mt-0.5">Requests for Information across all projects</div>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>＋ Create RFI</button>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex bg-white border border-[#DDDBDA] rounded-lg overflow-hidden">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={'px-3 py-1.5 text-[12.5px] font-semibold border-r border-[#ECEBEA] last:border-r-0 ' + (tab === t ? 'bg-[#EFF4FA] text-[#2C5485]' : 'text-[#706E6B]')}>{t}</button>
          ))}
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="border border-[#DDDBDA] rounded-md px-2.5 py-1.5 text-[12.5px]">
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search RFIs…" className="flex-1 min-w-[160px] border border-[#DDDBDA] rounded-md px-2.5 py-1.5 text-[12.5px]" />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-[#FBFCFE] text-[#706E6B] text-[10px] uppercase tracking-wide">
              {['RFI #', 'Subject', 'Project', 'Status', 'Ball in Court', 'Due', 'Days', 'Impact'].map(h => (
                <th key={h} className="text-left font-bold px-3 py-2.5 border-b border-[#DDDBDA] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-[#A8A8A8]">No RFIs match.</td></tr>
            )}
            {filtered.map(r => {
              const overdue = isOverdue(r)
              const st = STATUS_PILL[r.status] ?? STATUS_PILL.open
              const d = daysOpen(r)
              return (
                <tr key={r.id} onClick={() => router.push(`/rfis/${r.id}`)} className="hover:bg-[#FBFCFE] cursor-pointer border-b border-[#ECEBEA] last:border-b-0">
                  <td className="px-3 py-3 font-extrabold text-[#2C5485]">{rfiNo(r.rfi_number)}</td>
                  <td className="px-3 py-3 font-bold text-[#181818] max-w-[320px]">{r.subject}</td>
                  <td className="px-3 py-3 text-[#3E3E3C] whitespace-nowrap">{r.project?.name ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={overdue ? { background: '#FEF2F2', color: '#b91c1c' } : { background: st.bg, color: st.text }}>
                      {overdue ? 'Overdue' : st.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#3E3E3C] whitespace-nowrap">{ballName(r)}</td>
                  <td className="px-3 py-3 whitespace-nowrap" style={overdue ? { color: '#b91c1c', fontWeight: 600 } : {}}>{r.due_date ?? '—'}</td>
                  <td className="px-3 py-3 font-semibold text-[#3E3E3C]">{d ?? '—'}</td>
                  <td className="px-3 py-3 text-[10px] font-bold text-[#706E6B] whitespace-nowrap">
                    <span style={r.cost_impact === 'yes' ? { color: '#b91c1c' } : {}}>Cost: {r.cost_impact ?? 'tbd'}</span> · Sched: {r.schedule_impact ?? 'tbd'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {creating && <CreateRfiModal projects={projects} users={users} stakeholders={stakeholders} onClose={() => setCreating(false)}
        onCreated={r => { setRfis(prev => [{ ...r, project: projects.find(p => p.id === r.project_id) }, ...prev]); setCreating(false); router.push(`/rfis/${r.id}`) }} />}
    </div>
  )
}

function CreateRfiModal({ projects, users, stakeholders: initialStakeholders, onClose, onCreated }: { projects: Any[]; users: Any[]; stakeholders: Any[]; onClose: () => void; onCreated: (r: Any) => void }) {
  const [stakeholders, setStakeholders] = useState<Any[]>(initialStakeholders)
  const [f, setF] = useState<Any>({ project_id: '', subject: '', question: '', received_from_user_id: '', received_from_stakeholder_id: '', ball_in_court_user_id: '', due_date: '', cost_impact: 'tbd', schedule_impact: 'tbd', status: 'open' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: string, v: Any) => setF((p: Any) => ({ ...p, [k]: v }))

  async function create() {
    if (!f.project_id || !f.subject.trim()) { setErr('Project and subject are required.'); return }
    setSaving(true); setErr(null)
    const res = await fetch('/api/rfis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, ball_in_court_user_id: f.ball_in_court_user_id || null, received_from_user_id: f.received_from_user_id || null, received_from_stakeholder_id: f.received_from_stakeholder_id || null }) })
    setSaving(false)
    if (res.ok) onCreated(await res.json())
    else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Failed to create') }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[560px] max-w-[94vw] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-[#ECEBEA] font-bold text-[15px] text-[#080707]">Create RFI</div>
        <div className="p-5 flex flex-col gap-3">
          <Field label="Project *"><select value={f.project_id} onChange={e => set('project_id', e.target.value)} className="inp"><option value="">Select…</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Subject *"><input value={f.subject} onChange={e => set('subject', e.target.value)} className="inp" /></Field>
          <Field label="Question"><textarea value={f.question} onChange={e => set('question', e.target.value)} className="inp min-h-[70px]" /></Field>
          <Field label="Received from"><ReceivedFromPicker users={users} stakeholders={stakeholders.filter(s => !s.project_id || s.project_id === f.project_id)} projectId={f.project_id || null}
            userId={f.received_from_user_id} stakeholderId={f.received_from_stakeholder_id}
            onChange={(u, s) => setF((p: Any) => ({ ...p, received_from_user_id: u ?? '', received_from_stakeholder_id: s ?? '' }))}
            onStakeholderCreated={s => setStakeholders(prev => [...prev, s])} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ball in Court (internal)"><select value={f.ball_in_court_user_id} onChange={e => set('ball_in_court_user_id', e.target.value)} className="inp"><option value="">—</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Field>
            <Field label="Due date"><input type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} className="inp" /></Field>
            <Field label="Cost impact"><select value={f.cost_impact} onChange={e => set('cost_impact', e.target.value)} className="inp"><option value="tbd">TBD</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
            <Field label="Schedule impact"><select value={f.schedule_impact} onChange={e => set('schedule_impact', e.target.value)} className="inp"><option value="tbd">TBD</option><option value="yes">Yes</option><option value="no">No</option></select></Field>
          </div>
          {err && <div className="text-[12px] text-[#b91c1c]">{err}</div>}
        </div>
        <div className="px-5 py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE] flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={create}>{saving ? 'Creating…' : 'Create & Send'}</button>
        </div>
      </div>
      <style jsx>{`.inp{border:1px solid #DDDBDA;border-radius:7px;padding:7px 9px;font-size:13px;width:100%;font-family:inherit}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#706E6B]">{label}</span>
      {children}
    </label>
  )
}
