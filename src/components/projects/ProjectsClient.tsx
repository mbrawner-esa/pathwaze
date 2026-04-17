'use client'
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { ProjectCard } from './ProjectCard'

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
}

const STAGES = ['All', 'Prospecting', 'Proposal', 'Contracting', 'Permitting', 'Construction', 'Operations']
const STATES = ['All', 'FL', 'IL']
const ASSIGNEES = ['All', 'Morgan Brawner', 'Sarah Chen', 'James Wright']
const GROUP_OPTIONS = ['None', 'Tranche', 'Stage', 'State']

export function ProjectsClient({ projects }: ProjectsClientProps) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [groupBy, setGroupBy] = useState('None')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3E50]">Projects</h1>
          <p className="text-[#6E879E] text-sm mt-1">{filtered.length} of {projects.length} projects</p>
        </div>
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
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none"
        >
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none"
        >
          {STATES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select
          value={assigneeFilter}
          onChange={e => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none"
        >
          {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
        </select>
        <select
          value={groupBy}
          onChange={e => setGroupBy(e.target.value)}
          className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none bg-[#f8fafc]"
        >
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
    </div>
  )
}
