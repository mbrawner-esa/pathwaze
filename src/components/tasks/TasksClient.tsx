'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, List, LayoutGrid, ChevronRight, X, Plus, Send, MessageSquare, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { useRouter } from 'next/navigation'

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

const KANBAN_COLUMNS = ['Draft', 'Ready to Start', 'In Progress', 'Under Review', 'Pending Info', 'Complete']
const ALL_STATUSES = ['Draft', 'Ready to Start', 'In Progress', 'Under Review', 'Pending Info', 'Complete']
const TASK_TYPES = ['Design', 'Engineering', 'Permitting', 'Interconnection', 'Financial', 'Legal', 'Construction', 'Operations', 'Administrative']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TasksClient({ tasks: initialTasks, projects, users }: { tasks: any[]; projects: any[]; users: any[] }) {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Comment state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)

  // New task form
  const [form, setForm] = useState({
    project_id: '',
    title: '',
    description: '',
    type: 'Administrative',
    priority: 'Medium',
    assignee_id: '',
    approver_id: '',
    requires_approval: false,
    due_date: '',
  })

  const types = ['All', ...Array.from(new Set(initialTasks.map(t => t.type).filter(Boolean)))]
  const statuses = ['All', ...ALL_STATUSES]

  const filtered = useMemo(() => initialTasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    const matchType = typeFilter === 'All' || t.type === typeFilter
    const matchProject = projectFilter === 'All' || t.project_id === projectFilter
    return matchSearch && matchStatus && matchType && matchProject
  }), [initialTasks, search, statusFilter, typeFilter, projectFilter])

  const selected = initialTasks.find(t => t.id === selectedTask)

  // Load comments when a task is selected
  const loadComments = useCallback(async (taskId: string) => {
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`)
      if (res.ok) setComments(await res.json())
    } catch { /* ignore */ }
    setLoadingComments(false)
  }, [])

  useEffect(() => {
    if (selectedTask) loadComments(selectedTask)
    else setComments([])
  }, [selectedTask, loadComments])

  async function handleCreateTask() {
    if (!form.title || !form.project_id) return
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assignee_id: form.assignee_id || null,
          approver_id: form.requires_approval ? form.approver_id || null : null,
        }),
      })
      if (res.ok) {
        setShowNewModal(false)
        setForm({ project_id: '', title: '', description: '', type: 'Administrative', priority: 'Medium', assignee_id: '', approver_id: '', requires_approval: false, due_date: '' })
        router.refresh()
      }
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function handleApprove(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_status: 'Approved', status: 'Complete' }),
    })
    router.refresh()
  }

  async function handleRequestChanges(taskId: string) {
    const notes = prompt('Enter change request notes:')
    if (!notes) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_status: 'Changes Requested', approval_notes: notes, status: 'In Progress' }),
    })
    router.refresh()
  }

  async function sendComment() {
    if (!newComment.trim() || !selectedTask) return
    const res = await fetch(`/api/tasks/${selectedTask}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newComment }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments(prev => [...prev, comment])
      setNewComment('')
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2F3E50]">Tasks</h1>
          <p className="text-[#6E879E] text-sm mt-1">{filtered.length} tasks</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63]">
            <Plus size={14} /> New Task
          </button>
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
          {projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-[#94a3b8] text-sm">No tasks found</td></tr>
                  )}
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
                        <div key={task.id} className="card p-3 cursor-pointer hover:shadow-md" onClick={() => setSelectedTask(task.id)}
                          style={{ borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] ?? '#94a3b8'}` }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#6E879E]">{task.type}</span>
                            {task.due_date && <span className="text-[10px] text-[#94a3b8]">{formatDate(task.due_date)}</span>}
                          </div>
                          <p className="text-sm font-medium text-[#2F3E50] leading-tight mb-2">{task.title}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#94a3b8]">{task.project?.name}</span>
                            <div className="flex items-center gap-1">
                              {task.assignee?.full_name && <Avatar name={task.assignee.full_name} size="sm" />}
                            </div>
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
          <div className="w-96 card flex-shrink-0 flex flex-col max-h-[calc(100vh-200px)]">
            <div className="p-5 border-b border-[#f1f5f9]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f1f5f9] text-[#6E879E]">{selected.type}</span>
                    <span className="text-[10px] font-semibold" style={{ color: PRIORITY_COLORS[selected.priority] }}>{selected.priority}</span>
                  </div>
                  <h3 className="font-semibold text-[#2F3E50] text-sm">{selected.title}</h3>
                  {selected.project && <p className="text-xs text-[#94a3b8]">{selected.project.name}</p>}
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-[#94a3b8] hover:text-[#334155]"><X size={16} /></button>
              </div>

              {/* Clickable status stepper */}
              <div className="flex gap-1 overflow-x-auto">
                {ALL_STATUSES.map(s => {
                  const active = s === selected.status
                  const sc = STATUS_COLORS[s] ?? { bg: '#F8FAFC', text: '#475569' }
                  return (
                    <button key={s} onClick={() => updateTaskStatus(selected.id, s)}
                      className="text-[9px] px-1.5 py-1 rounded whitespace-nowrap font-medium transition-all hover:opacity-80"
                      style={{ backgroundColor: active ? sc.bg : '#F8FAFC', color: active ? sc.text : '#94a3b8', border: active ? `1px solid ${sc.text}40` : '1px solid transparent' }}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <div className="space-y-3 mb-4">
                {selected.description && (
                  <div>
                    <p className="label mb-1">Description</p>
                    <p className="text-sm text-[#334155] bg-[#f8fafc] rounded-lg p-3">{selected.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="label mb-0.5">Due Date</p><p className="text-sm text-[#334155]">{formatDate(selected.due_date)}</p></div>
                  <div><p className="label mb-0.5">Assignee</p><p className="text-sm text-[#334155]">{selected.assignee?.full_name ?? '—'}</p></div>
                </div>
              </div>

              {/* Approval section */}
              {selected.requires_approval && (
                <div className="mb-4 bg-[#FDF4FF] rounded-lg p-3">
                  <p className="label mb-2">Approval</p>
                  {selected.approval_status === 'Approved' ? (
                    <div className="flex items-center gap-2 text-[#166534]">
                      <CheckCircle size={14} />
                      <span className="text-xs font-medium">Approved</span>
                    </div>
                  ) : selected.approval_status === 'Changes Requested' ? (
                    <div>
                      <p className="text-xs text-[#dc2626] font-medium mb-1">Changes Requested</p>
                      {selected.approval_notes && <p className="text-xs text-[#dc2626] bg-[#FEF2F2] p-2 rounded">{selected.approval_notes}</p>}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(selected.id)}
                        className="text-xs px-3 py-1.5 bg-[#166534] text-white rounded-lg hover:bg-[#15803d]">
                        Approve
                      </button>
                      <button onClick={() => handleRequestChanges(selected.id)}
                        className="text-xs px-3 py-1.5 bg-white text-[#dc2626] border border-[#dc2626] rounded-lg hover:bg-[#FEF2F2]">
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Discussion thread */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} className="text-[#6E879E]" />
                  <p className="label">Discussion ({comments.length})</p>
                </div>
                {loadingComments ? (
                  <p className="text-xs text-[#94a3b8]">Loading...</p>
                ) : (
                  <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-2">
                        <Avatar name={c.user?.full_name ?? 'User'} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-[#2F3E50]">{c.user?.full_name ?? 'User'}</span>
                            <span className="text-[10px] text-[#94a3b8]">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-[#334155] mt-0.5">{c.message}</p>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-xs text-[#94a3b8]">No comments yet</p>}
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                    placeholder="Add a comment..." className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none" />
                  <button onClick={sendComment} className="p-2 bg-[#2F3E50] text-white rounded-lg hover:bg-[#3d4f63]">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#2F3E50]">New Task</h2>
              <button onClick={() => setShowNewModal(false)} className="text-[#94a3b8] hover:text-[#334155]"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label mb-1 block">Project *</label>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                  <option value="">Select project...</option>
                  {projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label mb-1 block">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" placeholder="Task title" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm h-20 resize-none" placeholder="Optional description..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1 block">Assignee</label>
                  <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Unassigned</option>
                    {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="requires_approval" checked={form.requires_approval}
                  onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))}
                  className="rounded border-[#e2e8f0]" />
                <label htmlFor="requires_approval" className="text-sm text-[#334155]">Requires Approval</label>
              </div>

              {form.requires_approval && (
                <div>
                  <label className="label mb-1 block">Approver</label>
                  <select value={form.approver_id} onChange={e => setForm(f => ({ ...f, approver_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
                    <option value="">Select approver...</option>
                    {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#f1f5f9]">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-sm text-[#6E879E] hover:text-[#2F3E50]">Cancel</button>
              <button onClick={handleCreateTask} disabled={saving || !form.title || !form.project_id}
                className="px-4 py-2 bg-[#2F3E50] text-[#E6C87A] rounded-lg text-sm font-medium hover:bg-[#3d4f63] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
