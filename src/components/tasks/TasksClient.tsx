'use client'
import { useState, useMemo } from 'react'
import { Search, List, LayoutGrid, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Draft': { bg: '#F8FAFC', text: '#475569' },
  'Ready to Start': { bg: '#EFF6FF', text: '#1d4ed8' },
  'In Progress': { bg: '#FFFBEB', text: '#92400e' },
  'Under Review': { bg: '#FDF4FF', text: '#7e22ce' },
  'Pending Info': { bg: '#FEF3C7', text: '#92400e' },
  'Complete': { bg: '#F0FDF4', text: '#166534' },
}

const PRIORITY_COLORS: Record<string, string> = {
  'High': '#ef4444',
  'Medium': '#f59e0b',
  'Low': '#94a3b8',
}

const KANBAN_COLUMNS = ['Ready to Start', 'In Progress', 'Under Review', 'Pending Info', 'Complete']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TasksClient({ tasks, projects, users: _users }: { tasks: any[]; projects: any[]; users: any[] }) {
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [selectedTask, setSelectedTask] = useState<string | null>(null)

  const types = ['All', ...Array.from(new Set(tasks.map(t => t.type)))]
  const statuses = ['All', 'Draft', 'Ready to Start', 'In Progress', 'Under Review', 'Pending Info', 'Complete']

  const filtered = useMemo(() => tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    const matchType = typeFilter === 'All' || t.type === typeFilter
    const matchProject = projectFilter === 'All' || t.project_id === projectFilter
    return matchSearch && matchStatus && matchType && matchProject
  }), [tasks, search, statusFilter, typeFilter, projectFilter])

  const selected = tasks.find(t => t.id === selectedTask)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3E50]">Tasks</h1>
          <p className="text-[#6E879E] text-sm mt-1">{filtered.length} tasks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-[#2F3E50] text-white' : 'btn-secondary'}`}><List size={16} /></button>
          <button onClick={() => setView('kanban')} className={`p-2 rounded-lg ${view === 'kanban' ? 'bg-[#2F3E50] text-white' : 'btn-secondary'}`}><LayoutGrid size={16} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none w-48" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {statuses.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          <option value="All">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="flex gap-6">
        <div className={`flex-1 ${selectedTask ? 'max-w-[60%]' : ''}`}>
          {view === 'list' ? (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                    <th className="text-left px-4 py-3 label">Task</th>
                    <th className="text-left px-4 py-3 label">Type</th>
                    <th className="text-left px-4 py-3 label">Status</th>
                    <th className="text-left px-4 py-3 label">Priority</th>
                    <th className="text-left px-4 py-3 label">Assignee</th>
                    <th className="text-left px-4 py-3 label">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(task => {
                    const sc = STATUS_COLORS[task.status] ?? { bg: '#F8FAFC', text: '#475569' }
                    return (
                      <tr key={task.id} className={`border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer ${selectedTask === task.id ? 'bg-[#EFF6FF]' : ''}`}
                        onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#94a3b8' }} />
                            <span className="font-medium text-[#2F3E50]">{task.title}</span>
                            {task.requires_approval && (
                              <span className="text-[10px] bg-[#FDF4FF] text-[#7e22ce] px-1.5 py-0.5 rounded">Approval</span>
                            )}
                          </div>
                          {task.project && <p className="text-xs text-[#94a3b8] mt-0.5 ml-3.5">{task.project.name}</p>}
                        </td>
                        <td className="px-4 py-3 text-[#6E879E]">{task.type}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{task.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span style={{ color: PRIORITY_COLORS[task.priority] }} className="text-xs font-semibold">{task.priority}</span>
                        </td>
                        <td className="px-4 py-3">
                          {task.assignee?.full_name && <Avatar name={task.assignee.full_name} size="sm" />}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6E879E]">{formatDate(task.due_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_COLUMNS.map(col => {
                const colTasks = filtered.filter(t => t.status === col)
                const sc = STATUS_COLORS[col] ?? { bg: '#F8FAFC', text: '#475569' }
                return (
                  <div key={col} className="w-64 flex-shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold" style={{ color: sc.text }}>{col}</span>
                      <span className="text-xs text-[#94a3b8]">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map(task => (
                        <div key={task.id} className="card p-3 cursor-pointer hover:shadow-md" onClick={() => setSelectedTask(task.id)}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium text-[#2F3E50] leading-tight">{task.title}</p>
                            <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#94a3b8' }} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#94a3b8]">{task.type}</span>
                            {task.assignee?.full_name && <Avatar name={task.assignee.full_name} size="sm" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Task Detail Panel */}
        {selected && (
          <div className="w-96 card p-5 flex-shrink-0">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-[#2F3E50] text-sm pr-4">{selected.title}</h3>
              <button onClick={() => setSelectedTask(null)} className="text-[#94a3b8] hover:text-[#334155]"><ChevronRight size={16} /></button>
            </div>

            {/* Status stepper */}
            <div className="flex gap-1 mb-4 overflow-x-auto">
              {['Draft','Ready to Start','In Progress','Under Review','Complete'].map(s => {
                const active = s === selected.status
                const sc = STATUS_COLORS[s] ?? { bg: '#F8FAFC', text: '#475569' }
                return (
                  <span key={s} className="text-[9px] px-1.5 py-1 rounded whitespace-nowrap font-medium"
                    style={{ backgroundColor: active ? sc.bg : '#F8FAFC', color: active ? sc.text : '#94a3b8', border: active ? `1px solid ${sc.text}20` : '1px solid transparent' }}>
                    {s}
                  </span>
                )
              })}
            </div>

            <div className="space-y-3 mb-4">
              {selected.description && (
                <div>
                  <p className="label mb-1">Description</p>
                  <p className="text-sm text-[#334155]">{selected.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div><p className="label mb-0.5">Type</p><p className="text-sm text-[#334155]">{selected.type}</p></div>
                <div><p className="label mb-0.5">Priority</p><p className="text-sm font-semibold" style={{ color: PRIORITY_COLORS[selected.priority] }}>{selected.priority}</p></div>
                <div><p className="label mb-0.5">Due Date</p><p className="text-sm text-[#334155]">{formatDate(selected.due_date)}</p></div>
                <div><p className="label mb-0.5">Assignee</p><p className="text-sm text-[#334155]">{selected.assignee?.full_name ?? '—'}</p></div>
              </div>
            </div>

            {selected.requires_approval && (
              <div className="bg-[#FDF4FF] rounded-lg p-3 mb-4">
                <p className="label mb-1">Approval Required</p>
                <p className="text-xs text-[#7e22ce]">Status: {selected.approval_status ?? 'Pending'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
