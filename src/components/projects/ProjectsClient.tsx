'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { ChevronDown, Search, Plus, X, Settings2, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { StageBadge } from '@/components/ui/StageBadge'
import { DealHealthBadge } from '@/components/ui/DealHealthBadge'
import { Avatar } from '@/components/ui/Avatar'
import { formatDate } from '@/lib/utils'

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
  utility?: string
  target_cod?: string
  assignee_name?: string
  assignee_avatar_url?: string | null
  next_milestone?: string
}

interface ProjectsClientProps {
  projects: Project[]
  users?: { id: string; full_name: string }[]
}

const STAGES = ['All', 'Archived', 'Pre-Planning', 'Design Development', 'Bidding', 'Late Stage Development', 'Pre-Closing', 'NTP', 'Pre-Construction', 'Active Construction', 'Post Construction', 'Closeout', 'Operating']
const STATES = ['All', 'FL', 'IL']
const GROUP_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'tranche', label: 'Tranche' },
  { value: 'stage', label: 'Stage' },
  { value: 'state', label: 'State' },
]
const TRANCHES = ['TR01 - GLR', 'TR02 - WFD', 'TR03 - CFD', 'TR04 - EFD', 'TR05 - CORP']
const FACILITY_TYPES = ['Acute Care Center', 'Medical Office', 'Distribution Center', 'Hospital', 'Outpatient Center']

function fmtKw(kwdc: number) {
  if (!kwdc) return '—'
  return `${kwdc.toLocaleString()} kWdc`
}


// ── Column definitions ────────────────────────────────────────────────────
type ColumnId = 'project' | 'stage' | 'size' | 'contract_value' | 'utility' | 'target_cod' | 'assignee' | 'tranche' | 'region' | 'deal_health' | 'next_milestone'

interface ColumnDef {
  id: ColumnId
  label: string
  alwaysVisible?: boolean   // can't be hidden by user
  defaultVisible: boolean
  width?: string            // padding-x: e.g. 'px-6' for first col, 'px-4' for others
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'project',        label: 'Project',         alwaysVisible: true, defaultVisible: true, width: 'px-6' },
  { id: 'stage',          label: 'Stage',           defaultVisible: true },
  { id: 'size',           label: 'Size',            defaultVisible: true },
  { id: 'contract_value', label: 'Contract Value',  defaultVisible: true },
  { id: 'utility',        label: 'Utility',         defaultVisible: true },
  { id: 'target_cod',     label: 'Target COD',      defaultVisible: true },
  { id: 'assignee',       label: 'Project Manager', defaultVisible: true },
  { id: 'tranche',        label: 'Tranche',         defaultVisible: false },
  { id: 'region',         label: 'Region',          defaultVisible: false },
  { id: 'deal_health',    label: 'Deal Health',     defaultVisible: false },
  { id: 'next_milestone', label: 'Next Milestone',  defaultVisible: false },
]

const DEFAULT_VISIBLE_COLS: ColumnId[] = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id)
const STORAGE_KEY = 'pathwaze.projects.columns'

export function ProjectsClient({ projects, users = [] }: ProjectsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [groupBy, setGroupBy] = useState('none')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Column visibility (persisted to localStorage)
  const [visibleCols, setVisibleCols] = useState<ColumnId[]>(DEFAULT_VISIBLE_COLS)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const columnPickerRef = useRef<HTMLDivElement>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          // Filter to valid column ids and ensure project is always included
          const valid = parsed.filter((id: string) => ALL_COLUMNS.some(c => c.id === id)) as ColumnId[]
          if (!valid.includes('project')) valid.unshift('project')
          setVisibleCols(valid)
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleCols)) } catch { /* ignore */ }
  }, [visibleCols])

  // Click outside to close column picker
  useEffect(() => {
    if (!showColumnPicker) return
    function onClickOutside(e: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showColumnPicker])

  function toggleCol(id: ColumnId) {
    setVisibleCols(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  // Resolve which columns to render (in canonical ALL_COLUMNS order)
  const activeCols = useMemo(
    () => ALL_COLUMNS.filter(c => visibleCols.includes(c.id)),
    [visibleCols]
  )

  const initialForm = {
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
    utility: '',
    assignee_id: '',
    target_cod: '',
  }
  const [form, setForm] = useState(initialForm)

  const assigneeNames = ['All', ...Array.from(new Set(projects.map(p => p.assignee_name).filter(Boolean) as string[]))]
  const totalMw = (projects.reduce((s, p) => s + (p.system_kwdc ?? 0), 0) / 1000).toFixed(2)

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
    if (groupBy === 'none') return null
    const groups: Record<string, Project[]> = {}
    filtered.forEach(p => {
      const key = groupBy === 'tranche' ? (p.tranche || 'Unassigned') :
        groupBy === 'stage' ? p.stage :
        groupBy === 'state' ? p.state : 'Other'
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
    setCreateError(null)
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
        setForm(initialForm)
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error || `Request failed with ${res.status}`
        console.error('Create project failed:', msg, body)
        setCreateError(msg)
      }
    } catch (err) {
      console.error('Create project error:', err)
      setCreateError(err instanceof Error ? err.message : 'Network error')
    }
    setSaving(false)
  }

  // ── Cell renderer ──
  function renderCell(colId: ColumnId, p: Project): React.ReactNode {
    switch (colId) {
      case 'project':
        return (
          <td key="project" className="px-6 py-3">
            <div className="text-sm font-semibold text-[#181818]">{p.name}</div>
            <div className="text-xs text-[#3E3E3C]">{p.project_number || ''} · {p.city}, {p.state}</div>
          </td>
        )
      case 'stage':
        return <td key="stage" className="px-4 py-3"><StageBadge stage={p.stage} /></td>
      case 'size':
        return <td key="size" className="px-4 py-3 text-sm font-semibold text-[#181818]">{fmtKw(p.system_kwdc)}</td>
      case 'contract_value':
        return <td key="contract_value" className="px-4 py-3 text-sm text-[#706E6B]">—</td>
      case 'utility':
        return <td key="utility" className="px-4 py-3 text-sm text-[#181818] max-w-[150px] truncate">{p.utility || '—'}</td>
      case 'target_cod':
        return <td key="target_cod" className="px-4 py-3 text-sm text-[#181818]">{formatDate(p.target_cod)}</td>
      case 'assignee':
        return (
          <td key="assignee" className="px-4 py-3">
            {p.assignee_name ? <Avatar name={p.assignee_name} imageUrl={p.assignee_avatar_url} size="sm" /> : <span className="text-xs text-[#A8A8A8]">—</span>}
          </td>
        )
      case 'tranche':
        return <td key="tranche" className="px-4 py-3 text-sm text-[#181818]">{p.tranche || '—'}</td>
      case 'region':
        return <td key="region" className="px-4 py-3 text-sm text-[#181818]">{p.region || '—'}</td>
      case 'deal_health':
        return <td key="deal_health" className="px-4 py-3"><DealHealthBadge health={p.deal_health} /></td>
      case 'next_milestone':
        return <td key="next_milestone" className="px-4 py-3 text-sm text-[#181818] max-w-[200px] truncate">{p.next_milestone || '—'}</td>
      default:
        return null
    }
  }

  // ── Table row renderer ──
  function ProjectRow({ p }: { p: Project }) {
    return (
      <tr
        onClick={() => router.push(`/projects/${p.id}`)}
        className="border-b border-[#f1f5f9] cursor-pointer hover:bg-[#f8fafc] transition-colors"
      >
        {activeCols.map(c => renderCell(c.id, p))}
      </tr>
    )
  }

  const TableHeader = (
    <thead>
      <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
        {activeCols.map(c => (
          <th
            key={c.id}
            className={`text-left ${c.width || 'px-4'} py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider`}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  )

  return (
    <div>
      {/* Sticky header bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-8 py-5 flex items-center justify-between sticky top-[52px] z-30">
        <div>
          <div className="text-xl font-bold text-[#3E3E3C]">Portfolio Overview</div>
          <div className="text-[13px] text-[#3E3E3C] mt-0.5">{projects.length} projects · {totalMw} kWdc total</div>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#70A0D0] text-white rounded-lg text-sm font-medium hover:bg-[#2C5485] transition-colors"
        >
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Body */}
      <div className="px-8 py-7">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B]" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-[#70A0D0] w-[200px] bg-white"
              />
            </div>
            <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {STAGES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Stages' : s}</option>)}
            </select>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {assigneeNames.map(a => <option key={a} value={a}>{a === 'All' ? 'All Project Managers' : a}</option>)}
            </select>
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
              {STATES.map(s => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
            </select>
            <div className="w-px h-5 bg-[#e2e8f0] mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#706E6B] uppercase tracking-wider">Group by</span>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none bg-white">
                {GROUP_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12.5px] text-[#706E6B]">{filtered.length} of {projects.length}</span>
              <div className="relative" ref={columnPickerRef}>
                <button
                  onClick={() => setShowColumnPicker(s => !s)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] font-semibold text-[#3E3E3C] bg-white border border-[#e2e8f0] rounded-lg hover:bg-[#fafbfc] transition-colors"
                >
                  <Settings2 size={13} /> Columns
                </button>
                {showColumnPicker && (
                  <div className="absolute right-0 top-[calc(100%+6px)] bg-white rounded-lg shadow-xl border border-[#e2e8f0] py-2 w-[220px] z-50">
                    <div className="px-3 py-1.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider border-b border-[#f1f5f9] mb-1">
                      Visible Columns
                    </div>
                    {ALL_COLUMNS.map(c => {
                      const checked = visibleCols.includes(c.id)
                      const locked = c.alwaysVisible
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2.5 px-3 py-1.5 text-[13px] ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-[#f8fafc]'}`}
                        >
                          <span
                            className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: checked ? '#70A0D0' : '#cbd5e1',
                              background: checked ? '#70A0D0' : 'white',
                            }}
                          >
                            {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                          </span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => !locked && toggleCol(c.id)}
                            disabled={locked}
                            className="sr-only"
                          />
                          <span className="text-[#181818] flex-1">{c.label}</span>
                          {locked && <span className="text-[10px] text-[#A8A8A8] uppercase tracking-wider">Locked</span>}
                        </label>
                      )
                    })}
                    <div className="border-t border-[#f1f5f9] mt-1 pt-1 px-3">
                      <button
                        onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}
                        className="w-full text-left py-1.5 text-[12px] text-[#3E3E3C] hover:text-[#181818]"
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          {!grouped ? (
            <table className="w-full border-collapse">
              {TableHeader}
              <tbody>
                {filtered.map(p => <ProjectRow key={p.id} p={p} />)}
                {filtered.length === 0 && (
                  <tr><td colSpan={activeCols.length} className="text-center py-12 text-[#706E6B] text-sm">No projects match your filters.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            Object.keys(grouped).sort().map(key => {
              const gp = grouped[key]
              const groupMw = (gp.reduce((s, p) => s + p.system_kwdc, 0) / 1000).toFixed(2)
              const isCollapsed = collapsed[key]
              return (
                <div key={key} className="mb-1">
                  <div
                    className="flex items-center gap-2.5 px-6 py-3.5 cursor-pointer border-b-2 border-[#e2e8f0]"
                    style={{ background: 'linear-gradient(90deg,#f0f4f8,#fafbfc)' }}
                    onClick={() => toggleGroup(key)}
                  >
                    <ChevronDown
                      size={12}
                      className="text-[#3E3E3C] transition-transform flex-shrink-0"
                      style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
                    />
                    <span className="text-sm font-bold text-[#3E3E3C]">{key}</span>
                    <span className="text-xs text-[#3E3E3C] font-medium">
                      {gp.length} project{gp.length !== 1 ? 's' : ''} · {groupMw} kWdc
                    </span>
                  </div>
                  {!isCollapsed && (
                    <table className="w-full border-collapse">
                      {TableHeader}
                      <tbody>
                        {gp.map(p => <ProjectRow key={p.id} p={p} />)}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* New Project Modal — Lightning-style */}
      {showNewModal && (
        <div className="fixed inset-0 bg-[#080A0F]/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowNewModal(false); setCreateError(null) }}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #2C5485 0%, #70A0D0 100%)' }}>
              <div>
                <div className="text-[11px] font-semibold text-white/75 uppercase tracking-[0.08em]">Project</div>
                <h2 className="text-[17px] font-semibold text-white mt-0.5">New Project</h2>
              </div>
              <button onClick={() => { setShowNewModal(false); setCreateError(null) }} className="text-white/70 hover:text-white p-1 rounded transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body — sections */}
            <div className="overflow-y-auto flex-1 bg-[#fafbfc]">
              {/* Section: Project Information */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Project Information</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4 bg-white">
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5"><span className="text-[#dc2626] mr-0.5">*</span>Project Name</label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="AdventHealth Site Name" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Project Number</label>
                    <input type="text" value={form.project_number} onChange={e => setForm(f => ({ ...f, project_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="21460-FL-XXXX" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Customer</label>
                    <input type="text" value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Stage</label>
                    <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      {STAGES.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">System Size (kWdc)</label>
                    <input type="number" value={form.system_kwdc} onChange={e => setForm(f => ({ ...f, system_kwdc: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Section: Location */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Location</h3>
                </div>
                <div className="px-6 py-5 bg-white space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Address</label>
                    <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="Street address" />
                  </div>
                  <div className="grid grid-cols-3 gap-x-5">
                    <div>
                      <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">City</label>
                      <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                        className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">State</label>
                      <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                        className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                        <option>FL</option>
                        <option>IL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Zip</label>
                      <input type="text" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                        className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Classification */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Classification</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4 bg-white">
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Tranche</label>
                    <select value={form.tranche} onChange={e => setForm(f => ({ ...f, tranche: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option value="">— Select tranche —</option>
                      {TRANCHES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Facility Type</label>
                    <select value={form.facility_type} onChange={e => setForm(f => ({ ...f, facility_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option value="">— Select type —</option>
                      {FACILITY_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Utility</label>
                    <input type="text" value={form.utility} onChange={e => setForm(f => ({ ...f, utility: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="e.g., Duke Energy, ComEd, FPL" />
                  </div>
                </div>
              </div>

              {/* Section: Timeline & Ownership */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Timeline & Ownership</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4 bg-white">
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Project Manager</label>
                    <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option value="">Unassigned</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Target COD</label>
                    <input type="date" value={form.target_cod} onChange={e => setForm(f => ({ ...f, target_cod: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all" />
                  </div>
                </div>
              </div>

              {createError && (
                <div className="px-6 py-3 bg-[#fef2f2] border-t border-[#fecaca]">
                  <div className="text-[12px] text-[#991b1b] flex items-start gap-2">
                    <span className="font-bold mt-0.5">!</span>
                    <span>{createError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div className="px-6 py-3 bg-[#f1f5f9] border-t border-[#e2e8f0] flex justify-end gap-2">
              <button onClick={() => { setShowNewModal(false); setCreateError(null) }}
                className="px-4 py-2 text-[13px] font-semibold text-[#3E3E3C] bg-white border border-[#cbd5e1] rounded hover:bg-[#fafbfc] transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || !form.name}
                className="px-4 py-2 text-[13px] font-semibold bg-[#70A0D0] text-white rounded hover:bg-[#2C5485] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
