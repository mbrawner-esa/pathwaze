'use client'
import { useState, useMemo } from 'react'
import { Search, Plus, X, Mail, Phone, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  'Supportive': { bg: '#F0FDF4', text: '#166534' },
  'Neutral': { bg: '#F8FAFC', text: '#475569' },
  'Concerned': { bg: '#FFFBEB', text: '#92400e' },
  'Opposed': { bg: '#FEF2F2', text: '#991b1b' },
}

const ROLES = ['Decision Maker', 'Evaluator', 'Influencer', 'Technical', 'Legal', 'Financial', 'Operations']
const SENTIMENTS = ['Supportive', 'Neutral', 'Concerned', 'Opposed']
const GROUP_OPTIONS = ['None', 'Role', 'Tranche', 'Site']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StakeholdersClient({ stakeholders, projects }: { stakeholders: any[]; projects?: any[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [trancheFilter, setTrancheFilter] = useState('All')
  const [groupBy, setGroupBy] = useState('None')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    project_id: '',
    name: '',
    title: '',
    department: '',
    role: 'Evaluator',
    email: '',
    phone: '',
    sentiment: 'Neutral',
    is_primary: false,
    org: '',
  })

  const roles = ['All', ...Array.from(new Set(stakeholders.map(s => s.role).filter(Boolean)))]
  const tranches = ['All', ...Array.from(new Set(stakeholders.map(s => s.project?.tranche).filter(Boolean)))]

  const filtered = useMemo(() => stakeholders.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.department?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || s.role === roleFilter
    const matchTranche = trancheFilter === 'All' || s.project?.tranche === trancheFilter
    return matchSearch && matchRole && matchTranche
  }), [stakeholders, search, roleFilter, trancheFilter])

  const grouped = useMemo(() => {
    if (groupBy === 'None') return { 'All Stakeholders': filtered }
    const groups: Record<string, typeof filtered> = {}
    filtered.forEach(s => {
      const key = groupBy === 'Role' ? (s.role || 'Unknown')
        : groupBy === 'Tranche' ? (s.project?.tranche || 'Global')
        : groupBy === 'Site' ? (s.project?.name || 'Global')
        : 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(s)
    })
    return groups
  }, [filtered, groupBy])

  const selected = stakeholders.find(s => s.id === selectedId)

  async function handleCreate() {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/stakeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, project_id: form.project_id || null }),
      })
      if (res.ok) {
        setShowNewModal(false)
        setForm({ project_id: '', name: '', title: '', department: '', role: 'Evaluator', email: '', phone: '', sentiment: 'Neutral', is_primary: false, org: '' })
        router.refresh()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this stakeholder?')) return
    await fetch(`/api/stakeholders/${id}`, { method: 'DELETE' })
    setSelectedId(null)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3E50]">Stakeholders</h1>
          <p className="text-[#6E879E] text-sm mt-1">{filtered.length} of {stakeholders.length} contacts</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63]">
          <Plus size={14} /> New Stakeholder
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input type="text" placeholder="Search stakeholders..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none w-56" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {roles.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={trancheFilter} onChange={e => setTrancheFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {tranches.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm bg-[#f8fafc]">
          {GROUP_OPTIONS.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 ${selectedId ? 'max-w-[60%]' : ''}`}>
          {Object.entries(grouped).map(([groupName, groupStakeholders]) => (
            <div key={groupName} className="mb-6">
              {groupBy !== 'None' && (
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-semibold text-[#2F3E50] text-sm">{groupName}</h2>
                  <span className="text-xs bg-[#f1f5f9] text-[#6E879E] px-2 py-0.5 rounded-full">{groupStakeholders.length}</span>
                </div>
              )}
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                      <th className="text-left px-4 py-3 label">Name</th>
                      <th className="text-left px-4 py-3 label">Title</th>
                      <th className="text-left px-4 py-3 label">Role</th>
                      <th className="text-left px-4 py-3 label">Site</th>
                      <th className="text-left px-4 py-3 label">Sentiment</th>
                      <th className="text-left px-4 py-3 label">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStakeholders.map(s => {
                      const sc = SENTIMENT_COLORS[s.sentiment] ?? { bg: '#F8FAFC', text: '#475569' }
                      return (
                        <tr key={s.id} className={`border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer ${selectedId === s.id ? 'bg-[#EFF6FF]' : ''}`}
                          onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#2F3E50]">{s.name}</span>
                              {s.is_primary && <span className="text-[10px] bg-[#2F3E50] text-[#E6C87A] px-1.5 py-0.5 rounded">Primary</span>}
                            </div>
                            {s.org && <p className="text-xs text-[#94a3b8]">{s.org}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#6E879E] text-xs max-w-[200px]">{s.title}</td>
                          <td className="px-4 py-3 text-[#6E879E]">{s.role}</td>
                          <td className="px-4 py-3">
                            {s.project ? (
                              <Link href={`/projects/${s.project_id}#stakeholders`} className="text-[#2F3E50] hover:underline text-xs"
                                onClick={e => e.stopPropagation()}>
                                {s.project.name}
                              </Link>
                            ) : <span className="text-xs text-[#94a3b8]">Global</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{s.sentiment}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#6E879E]">
                            {s.email && s.email !== 'TBD' ? (
                              <a href={`mailto:${s.email}`} className="hover:text-[#2F3E50]" onClick={e => e.stopPropagation()}>{s.email}</a>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Stakeholder Detail Panel */}
        {selected && (
          <div className="w-96 card p-5 flex-shrink-0 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-[#2F3E50]">{selected.name}</h3>
                  {selected.is_primary && <span className="text-[10px] bg-[#2F3E50] text-[#E6C87A] px-1.5 py-0.5 rounded">Primary</span>}
                </div>
                <p className="text-xs text-[#6E879E]">{selected.title}{selected.org ? ` · ${selected.org}` : ''}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-[#94a3b8] hover:text-[#334155]"><X size={16} /></button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="label mb-0.5">Role</p>
                  <p className="text-sm text-[#334155]">{selected.role}</p>
                </div>
                <div>
                  <p className="label mb-0.5">Department</p>
                  <p className="text-sm text-[#334155]">{selected.department || '—'}</p>
                </div>
                <div>
                  <p className="label mb-0.5">Sentiment</p>
                  <span className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: SENTIMENT_COLORS[selected.sentiment]?.bg, color: SENTIMENT_COLORS[selected.sentiment]?.text }}>
                    {selected.sentiment}
                  </span>
                </div>
                <div>
                  <p className="label mb-0.5">Organization</p>
                  <p className="text-sm text-[#334155]">{selected.org || '—'}</p>
                </div>
              </div>

              {selected.email && selected.email !== 'TBD' && (
                <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm text-[#2F3E50] hover:text-[#E6C87A] transition-colors">
                  <Mail size={14} className="text-[#6E879E]" /> {selected.email}
                </a>
              )}
              {selected.phone && selected.phone !== 'TBD' && (
                <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-sm text-[#2F3E50] hover:text-[#E6C87A] transition-colors">
                  <Phone size={14} className="text-[#6E879E]" /> {selected.phone}
                </a>
              )}
              {selected.project && (
                <Link href={`/projects/${selected.project_id}`} className="flex items-center gap-2 text-sm text-[#2F3E50] hover:text-[#E6C87A] transition-colors">
                  <Building2 size={14} className="text-[#6E879E]" /> {selected.project.name}
                </Link>
              )}
            </div>

            <div className="pt-3 border-t border-[#f1f5f9]">
              <button onClick={() => handleDelete(selected.id)}
                className="text-xs text-[#dc2626] hover:text-[#b91c1c]">
                Delete Stakeholder
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Stakeholder Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#2F3E50]">New Stakeholder</h2>
              <button onClick={() => setShowNewModal(false)} className="text-[#94a3b8] hover:text-[#334155]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Full name" />
                </div>
                <div>
                  <label className="label mb-1 block">Organization</label>
                  <input type="text" value={form.org} onChange={e => setForm(f => ({ ...f, org: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Company name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Title</label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Job title" />
                </div>
              </div>

              <div>
                <label className="label mb-1 block">Department</label>
                <input type="text" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Department" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="label mb-1 block">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="(555) 555-5555" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Sentiment</label>
                  <select value={form.sentiment} onChange={e => setForm(f => ({ ...f, sentiment: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    {SENTIMENTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Project</label>
                  <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Global (no project)</option>
                    {(projects ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_primary" checked={form.is_primary}
                  onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="rounded border-[#e2e8f0]" />
                <label htmlFor="is_primary" className="text-sm text-[#334155]">Primary Contact</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-[#6E879E] hover:text-[#2F3E50]">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="px-4 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Stakeholder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
