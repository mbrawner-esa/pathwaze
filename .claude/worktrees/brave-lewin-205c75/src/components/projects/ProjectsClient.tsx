'use client'
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search, Plus, X } from 'lucide-react'
import { ProjectCard } from './ProjectCard'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  project_number: string
  name: string
  stage: string
  deal_health: string
  system_kwdc: number
  city: string
  state: string
  tranche: string
  region: string
  assignee_name?: string
  next_milestone?: string
}

interface ProjectsClientProps {
  projects: Project[]
  users?: { id: string; full_name: string }[]
}

const STAGES = ['All', 'Prospecting', 'Proposal', 'Contracting', 'Permitting', 'Construction', 'Operations']
const STATES = ['All', 'FL', 'IL']
const GROUP_OPTIONS = ['None', 'Tranche', 'Stage', 'State']
const TRANCHES = ['TR01 - GLR', 'TR02 - WFD', 'TR03 - CFD', 'TR04 - EFD', 'TR05 - CORP']
const FACILITY_TYPES = ['Acute Care Center', 'Medical Office', 'Distribution Center', 'Hospital', 'Outpatient Center']

export function ProjectsClient({ projects, users = [] }: ProjectsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [groupBy, setGroupBy] = useState('None')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    project_number: '',
    customer: 'AdventHealth',
    stage: 'Prospecting',
    system_kwdc: '',
    address: '',
    city: '',
    state: 'FL',
    zip: '',
    tranche: '',
    facility_type: '',
    assignee_id: '',
    target_cod: '',
  })

  const assigneeNames = ['All', ...Array.from(new Set(projects.map(p => p.assignee_name).filter(Boolean) as string[]))]

  const filtered = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.project_number.toLowerCase().includes(search.toLowerCase()) ||
        p.city.toLowerCase().includes(search.toLowerCase())
      const matchStage = stageFilter === 'All' || p.stage === stageFilter
      const matchState = stateFilter === 'All' || p.state === stateFilter
      const matchAssignee = assigneeFilter === 'All' || p.assignee_name === assigneeFilter
      return matchSearch && matchStage && matchState && matchAssignee
    })
  }, [projects, search, stageFilter, stateFilter, assigneeFilter])

  const grouped = useMemo(() => {
    if (groupBy === 'None') return { 'All Projects': filtered }
    const groups: Record<string, Project[]> = {}
    filtered.forEach(p => {
      const key = groupBy === 'Tranche' ? p.tranche :
        groupBy === 'Stage' ? p.stage :
        groupBy === 'State' ? p.state : 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [filtered, groupBy])

  function toggleGroup(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleCreate() {
    if (!form.name) return
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          system_kwdc: form.system_kwdc ? Number(form.system_kwdc) : 0,
          system_kwac: 0,
          assignee_id: form.assignee_id || null,
        }),
      })
      if (res.ok) {
        setShowNewModal(false)
        setForm({ name: '', project_number: '', customer: 'AdventHealth', stage: 'Prospecting', system_kwdc: '', address: '', city: '', state: 'FL', zip: '', tranche: '', facility_type: '', assignee_id: '', target_cod: '' })
        router.refresh()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3E50]">Projects</h1>
          <p className="text-[#6E879E] text-sm mt-1">{filtered.length} of {projects.length} projects</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63]">
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2F3E50] w-56"
          />
        </div>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none">
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none">
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none">
          {assigneeNames.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none bg-[#f8fafc]">
          {GROUP_OPTIONS.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      {/* Project Groups */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([groupName, groupProjects]) => (
          <div key={groupName}>
            {groupBy !== 'None' && (
              <button
                onClick={() => toggleGroup(groupName)}
                className="flex items-center gap-2 mb-3 w-full text-left"
              >
                {collapsed[groupName] ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <h2 className="font-semibold text-[#2F3E50]">{groupName}</h2>
                <span className="text-xs text-[#94a3b8]">({groupProjects.length} projects)</span>
                <span className="text-xs text-[#94a3b8]">
                  · {(groupProjects.reduce((s, p) => s + p.system_kwdc, 0) / 1000).toFixed(2)} MWdc
                </span>
              </button>
            )}
            {!collapsed[groupName] && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupProjects.map(p => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#2F3E50]">New Project</h2>
              <button onClick={() => setShowNewModal(false)} className="text-[#94a3b8] hover:text-[#334155]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label mb-1 block">Project Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="AdventHealth Site Name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Project Number</label>
                  <input type="text" value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="21460-FL-XXXX" />
                </div>
                <div>
                  <label className="label mb-1 block">Customer</label>
                  <input type="text" value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    {STAGES.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">System Size (kWdc)</label>
                  <input type="number" value={form.system_kwdc} onChange={e => setForm(f => ({ ...f, system_kwdc: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="label mb-1 block">Address</label>
                <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Street address" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label mb-1 block">City</label>
                  <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" />
                </div>
                <div>
                  <label className="label mb-1 block">State</label>
                  <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option>FL</option>
                    <option>IL</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Zip</label>
                  <input type="text" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Tranche</label>
                  <select value={form.tranche} onChange={e => setForm(f => ({ ...f, tranche: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Select tranche...</option>
                    {TRANCHES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Facility Type</label>
                  <select value={form.facility_type} onChange={e => setForm(f => ({ ...f, facility_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Select type...</option>
                    {FACILITY_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Assignee</label>
                  <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Target COD</label>
                  <input type="date" value={form.target_cod} onChange={e => setForm(f => ({ ...f, target_cod: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-[#6E879E] hover:text-[#2F3E50]">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="px-4 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
