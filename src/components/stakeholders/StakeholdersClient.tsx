'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, Plus, X, Mail, Phone, MessageSquare, Activity, Slack, Pencil, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

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
  const [siteFilter, setSiteFilter] = useState('All')
  const [primaryFilter, setPrimaryFilter] = useState<'All' | 'Primary' | 'Non-primary'>('All')
  const [groupBy, setGroupBy] = useState('None')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Drawer state — Threads / Activity / Emails
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [threads, setThreads] = useState<any[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [newThread, setNewThread] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activity, setActivity] = useState<any[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emails, setEmails] = useState<any[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)

  // Edit state
  const [editingDrawer, setEditingDrawer] = useState(false)
  const [savingDrawer, setSavingDrawer] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '', title: '', department: '', role: 'Evaluator',
    email: '', phone: '', sentiment: 'Neutral', is_primary: false,
    org: '', project_id: '',
  })

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
  const sites = ['All', ...Array.from(new Set(stakeholders.map(s => s.project?.name).filter(Boolean) as string[])).sort()]

  const filtered = useMemo(() => stakeholders.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.department?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || s.role === roleFilter
    const matchTranche = trancheFilter === 'All' || s.project?.tranche === trancheFilter
    const matchSite = siteFilter === 'All' || s.project?.name === siteFilter
    const matchPrimary = primaryFilter === 'All'
      || (primaryFilter === 'Primary' && !!s.is_primary)
      || (primaryFilter === 'Non-primary' && !s.is_primary)
    return matchSearch && matchRole && matchTranche && matchSite && matchPrimary
  }), [stakeholders, search, roleFilter, trancheFilter, siteFilter, primaryFilter])

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

  // Drawer data loaders
  const loadThreads = useCallback(async (id: string) => {
    setLoadingThreads(true)
    try {
      const res = await fetch(`/api/stakeholders/${id}/comments`)
      if (res.ok) setThreads(await res.json())
    } catch { /* ignore */ }
    setLoadingThreads(false)
  }, [])

  const loadActivity = useCallback(async (id: string) => {
    setLoadingActivity(true)
    try {
      const res = await fetch(`/api/stakeholders/${id}/activity`)
      if (res.ok) setActivity(await res.json())
    } catch { /* ignore */ }
    setLoadingActivity(false)
  }, [])

  const loadEmails = useCallback(async (id: string) => {
    setLoadingEmails(true)
    try {
      const res = await fetch(`/api/stakeholders/${id}/emails`)
      if (res.ok) setEmails(await res.json())
    } catch { /* ignore */ }
    setLoadingEmails(false)
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadThreads(selectedId)
      loadActivity(selectedId)
      loadEmails(selectedId)
    } else {
      setThreads([]); setActivity([]); setEmails([])
    }
    setEditingDrawer(false)
    setEditError(null)
  }, [selectedId, loadThreads, loadActivity, loadEmails])

  async function sendThread() {
    if (!selectedId || !newThread.trim()) return
    const res = await fetch(`/api/stakeholders/${selectedId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newThread }),
    })
    if (res.ok) {
      const created = await res.json()
      setThreads(prev => [...prev, created])
      setNewThread('')
    }
  }

  function startDrawerEdit() {
    if (!selected) return
    setEditForm({
      name: selected.name ?? '',
      title: selected.title ?? '',
      department: selected.department ?? '',
      role: selected.role ?? 'Evaluator',
      email: selected.email ?? '',
      phone: selected.phone ?? '',
      sentiment: selected.sentiment ?? 'Neutral',
      is_primary: !!selected.is_primary,
      org: selected.org ?? '',
      project_id: selected.project_id ?? '',
    })
    setEditingDrawer(true)
    setEditError(null)
  }

  async function saveDrawerEdit() {
    if (!selected) return
    if (!editForm.name.trim()) { setEditError('Name is required'); return }
    setSavingDrawer(true); setEditError(null)
    try {
      const res = await fetch(`/api/stakeholders/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          title: editForm.title,
          department: editForm.department,
          role: editForm.role,
          email: editForm.email,
          phone: editForm.phone,
          sentiment: editForm.sentiment,
          is_primary: editForm.is_primary,
          org: editForm.org,
          project_id: editForm.project_id || null,
        }),
      })
      if (res.ok) {
        setEditingDrawer(false)
        router.refresh()
        loadActivity(selected.id)
      } else {
        const body = await res.json().catch(() => ({}))
        setEditError(body?.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Network error')
    }
    setSavingDrawer(false)
  }

  return (
    <div>
      {/* Sticky header bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-8 py-5 flex items-center justify-between sticky top-[52px] z-30">
        <div>
          <div className="text-xl font-bold text-[#3E3E3C]">Stakeholders</div>
          <div className="text-[13px] text-[#3E3E3C] mt-0.5">{filtered.length} of {stakeholders.length} contacts</div>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#70A0D0] text-white rounded-lg text-sm font-medium hover:bg-[#2C5485] transition-colors">
          <Plus size={14} /> New Stakeholder
        </button>
      </div>

      {/* Body */}
      <div className="px-8 py-7">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B]" />
              <input type="text" placeholder="Search stakeholders..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#70A0D0] w-[200px] bg-white" />
            </div>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {roles.map(r => <option key={r}>{r === 'All' ? 'All Roles' : r}</option>)}
            </select>
            <select value={trancheFilter} onChange={e => setTrancheFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {tranches.map(t => <option key={t}>{t === 'All' ? 'All Tranches' : t}</option>)}
            </select>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {sites.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sites' : s}</option>)}
            </select>
            <select
              value={primaryFilter}
              onChange={e => setPrimaryFilter(e.target.value as 'All' | 'Primary' | 'Non-primary')}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white"
            >
              <option value="All">All Contacts</option>
              <option value="Primary">Primary only</option>
              <option value="Non-primary">Non-primary</option>
            </select>
            <div className="w-px h-5 bg-[#e2e8f0] mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#706E6B] uppercase tracking-wider">Group by</span>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
                {GROUP_OPTIONS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div>
          {Object.entries(grouped).map(([groupName, groupStakeholders]) => (
            <div key={groupName}>
              {groupBy !== 'None' && (
                <div className="flex items-center gap-2.5 px-6 py-3 border-b border-[#e2e8f0]" style={{ background: 'linear-gradient(90deg,#f0f4f8,#fafbfc)' }}>
                  <span className="text-[13px] font-bold text-[#181818]">{groupName}</span>
                  <span className="text-[11.5px] text-[#3E3E3C] font-medium">{groupStakeholders.length} contact{groupStakeholders.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div>
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
                              <span className="font-medium text-[#181818]">{s.name}</span>
                              {s.is_primary && <span className="text-[10px] bg-[#70A0D0] text-white px-1.5 py-0.5 rounded">Primary</span>}
                            </div>
                            {s.org && <p className="text-xs text-[#706E6B]">{s.org}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#3E3E3C] text-xs max-w-[200px]">{s.title}</td>
                          <td className="px-4 py-3 text-[#3E3E3C]">{s.role}</td>
                          <td className="px-4 py-3">
                            {s.project ? (
                              <Link href={`/projects/${s.project_id}#stakeholders`} className="text-[#181818] hover:underline text-xs"
                                onClick={e => e.stopPropagation()}>
                                {s.project.name}
                              </Link>
                            ) : <span className="text-xs text-[#706E6B]">Global</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{s.sentiment}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#3E3E3C]">
                            {s.email && s.email !== 'TBD' ? (
                              <a href={`mailto:${s.email}`} className="hover:text-[#181818]" onClick={e => e.stopPropagation()}>{s.email}</a>
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
        </div>

      </div>

      {/* Stakeholder Detail — full-record drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedId(null)} />
          <div className="fixed top-[52px] right-0 bottom-0 z-50 bg-white w-full max-w-[720px] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-[#706E6B] uppercase tracking-[0.08em]">Stakeholder</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F1F5F9] text-[#3E3E3C]">{editingDrawer ? editForm.role : selected.role}</span>
                    {(() => {
                      const s = editingDrawer ? editForm.sentiment : selected.sentiment
                      const sc = SENTIMENT_COLORS[s] ?? { bg: '#F1F5F9', text: '#3E3E3C' }
                      return <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: sc.bg, color: sc.text }}>{s}</span>
                    })()}
                    {(editingDrawer ? editForm.is_primary : selected.is_primary) && (
                      <span className="text-[10px] font-bold tracking-wide bg-[#E6C87A22] text-[#b8963a] px-1.5 py-0.5 rounded">PRIMARY</span>
                    )}
                  </div>
                  {editingDrawer ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full text-[18px] font-semibold text-[#181818] leading-tight bg-white border border-[#cbd5e1] rounded px-2 py-1 focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      placeholder="Stakeholder name"
                    />
                  ) : (
                    <h2 className="text-[18px] font-semibold text-[#181818] leading-tight">{selected.name}</h2>
                  )}
                  <p className="text-[12.5px] text-[#3E3E3C] mt-1">
                    {selected.title}
                    {selected.org && <> · {selected.org}</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingDrawer ? (
                    <>
                      <button onClick={() => { setEditingDrawer(false); setEditError(null) }} disabled={savingDrawer} className="btn-secondary">Cancel</button>
                      <button onClick={saveDrawerEdit} disabled={savingDrawer} className="btn-primary">{savingDrawer ? 'Saving…' : 'Save'}</button>
                    </>
                  ) : (
                    <button onClick={startDrawerEdit} title="Edit" className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors">
                      <Pencil size={16} />
                    </button>
                  )}
                  <button onClick={() => setSelectedId(null)} className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 bg-[#fafbfc]">
              {editingDrawer ? (
                /* Edit form */
                <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden mb-5">
                  <div className="px-4 py-3 bg-[#F3F2F2] border-b border-[#e2e8f0]">
                    <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Edit Stakeholder</h3>
                  </div>
                  <div className="px-5 py-5 grid grid-cols-2 gap-x-5 gap-y-4">
                    <div className="col-span-2">
                      <label className="label block mb-1">Title</label>
                      <input type="text" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    </div>
                    <div>
                      <label className="label block mb-1">Department</label>
                      <input type="text" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    </div>
                    <div>
                      <label className="label block mb-1">Role</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20">
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Sentiment</label>
                      <select value={editForm.sentiment} onChange={e => setEditForm(f => ({ ...f, sentiment: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20">
                        {SENTIMENTS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Organization</label>
                      <input type="text" value={editForm.org} onChange={e => setEditForm(f => ({ ...f, org: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    </div>
                    <div>
                      <label className="label block mb-1">Email</label>
                      <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    </div>
                    <div>
                      <label className="label block mb-1">Phone</label>
                      <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    </div>
                    <div className="col-span-2">
                      <label className="label block mb-1">Project</label>
                      <select value={editForm.project_id} onChange={e => setEditForm(f => ({ ...f, project_id: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20">
                        <option value="">— Global (no project) —</option>
                        {(projects ?? []).map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2 flex items-center gap-2.5">
                      <input type="checkbox" id="sh_is_primary" checked={editForm.is_primary}
                        onChange={e => setEditForm(f => ({ ...f, is_primary: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#cbd5e1]" />
                      <label htmlFor="sh_is_primary" className="text-[13px] text-[#181818] font-medium cursor-pointer">Primary contact for this project</label>
                    </div>
                  </div>
                  {editError && (
                    <div className="px-5 py-2.5 bg-[#fef2f2] border-t border-[#fecaca] text-[12px] text-[#991b1b]">{editError}</div>
                  )}
                </div>
              ) : (
                /* Meta grid */
                <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden mb-5">
                  <div className="grid grid-cols-2 divide-x divide-[#f1f5f9]">
                    <div className="px-4 py-3">
                      <p className="label mb-1">Site</p>
                      {selected.project ? (
                        <Link href={`/projects/${selected.project_id}`} className="text-[13px] text-[#181818] font-medium hover:text-[#2C5485]">
                          {selected.project.name}
                        </Link>
                      ) : <span className="text-[13px] text-[#706E6B]">Global</span>}
                    </div>
                    <div className="px-4 py-3">
                      <p className="label mb-1">Department</p>
                      <p className="text-[13px] font-medium text-[#181818]">{selected.department || '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-[#f1f5f9] border-t border-[#f1f5f9]">
                    <div className="px-4 py-3">
                      <p className="label mb-1">Email</p>
                      {selected.email && selected.email !== 'TBD' ? (
                        <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-[13px] text-[#181818] hover:text-[#2C5485] break-all">
                          <Mail size={13} className="text-[#706E6B] flex-shrink-0" /> {selected.email}
                        </a>
                      ) : <span className="text-[13px] text-[#A8A8A8] italic">Not provided</span>}
                    </div>
                    <div className="px-4 py-3">
                      <p className="label mb-1">Phone</p>
                      {selected.phone && selected.phone !== 'TBD' ? (
                        <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 text-[13px] text-[#181818] hover:text-[#2C5485]">
                          <Phone size={13} className="text-[#706E6B] flex-shrink-0" /> {selected.phone}
                        </a>
                      ) : <span className="text-[13px] text-[#A8A8A8] italic">Not provided</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Threads */}
              <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#3E3E3C]" />
                    <span className="text-[13px] font-semibold text-[#181818]">Threads</span>
                    <span className="text-[11px] text-[#706E6B]">{threads.length}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F4ECE7] text-[#611f69]" title="Slack sync coming soon">
                    <Slack size={10} /> Slack — soon
                  </span>
                </div>
                <div className="px-4 py-3">
                  {loadingThreads ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : (
                    <div className="space-y-3 mb-3">
                      {threads.map(t => (
                        <div key={t.id} className="flex gap-2.5">
                          <Avatar name={t.user_name || 'User'} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-[#181818]">{t.user_name || 'User'}</span>
                              <span className="text-[10.5px] text-[#706E6B]">{formatDate(t.date)}</span>
                            </div>
                            <p className="text-[13px] text-[#181818] mt-0.5">{t.text}</p>
                          </div>
                        </div>
                      ))}
                      {threads.length === 0 && <p className="text-xs text-[#706E6B] py-2">No messages yet — start the conversation.</p>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={newThread} onChange={e => setNewThread(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThread() } }}
                      placeholder="Add a message..." className="flex-1 px-3 py-2 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    <button onClick={sendThread} className="p-2 bg-[#70A0D0] text-white rounded hover:bg-[#2C5485] transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-2">
                  <Activity size={14} className="text-[#3E3E3C]" />
                  <span className="text-[13px] font-semibold text-[#181818]">Activity</span>
                  <span className="text-[11px] text-[#706E6B]">{activity.length}</span>
                </div>
                <div className="px-4 py-3">
                  {loadingActivity ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : activity.length === 0 ? (
                    <p className="text-xs text-[#706E6B] py-2">No activity yet — field changes will appear here.</p>
                  ) : (
                    <ul className="space-y-3">
                      {activity.map(a => {
                        const m = a.metadata ?? {}
                        return (
                          <li key={a.id} className="flex gap-2.5 text-[13px]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#70A0D0] mt-[7px] flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[#181818]">
                                <span className="font-semibold">{a.user?.full_name ?? 'Someone'}</span>{' '}
                                changed {m.field || a.action.replace(/_/g, ' ')} from <em>{m.from || '—'}</em> → <em>{m.to || '—'}</em>
                              </p>
                              <p className="text-[10.5px] text-[#706E6B] mt-0.5">{formatDate(a.created_at)}</p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Emails */}
              <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-[#3E3E3C]" />
                    <span className="text-[13px] font-semibold text-[#181818]">Emails</span>
                    <span className="text-[11px] text-[#706E6B]">{emails.length}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EAF2FB] text-[#0078d4]" title="Outlook sync coming soon">
                    <Mail size={10} /> Outlook — soon
                  </span>
                </div>
                <div className="px-4 py-3">
                  {loadingEmails ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : emails.length === 0 ? (
                    <p className="text-xs text-[#706E6B] py-2">No emails synced yet — connect Outlook to pull email threads with this contact.</p>
                  ) : (
                    <ul className="divide-y divide-[#f1f5f9]">
                      {emails.map(e => (
                        <li key={e.id} className="py-2.5">
                          <p className="text-[13px] font-semibold text-[#181818]">{e.subject || '(no subject)'}</p>
                          <p className="text-[11.5px] text-[#706E6B] mt-0.5">{e.user_name || '—'} · {formatDate(e.date)}</p>
                          {e.text && <p className="text-[12.5px] text-[#3E3E3C] mt-1 line-clamp-2">{e.text}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Delete */}
              <div className="pt-3 border-t border-[#e2e8f0]">
                <button onClick={() => handleDelete(selected.id)}
                  className="text-xs text-[#dc2626] hover:text-[#b91c1c]">
                  Delete Stakeholder
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Stakeholder Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#181818]">New Stakeholder</h2>
              <button onClick={() => setShowNewModal(false)} className="text-[#706E6B] hover:text-[#181818]"><X size={18} /></button>
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
                <label htmlFor="is_primary" className="text-sm text-[#181818]">Primary Contact</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-[#3E3E3C] hover:text-[#181818]">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="px-4 py-2 bg-[#70A0D0] text-white rounded-lg text-sm font-medium hover:bg-[#2C5485] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Stakeholder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

