'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Search, List, LayoutGrid, X, Plus, Send, MessageSquare, CheckCircle, Activity, Slack, Pencil, Paperclip, ExternalLink, Trash2, Upload, Download, ChevronDown } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserClient } from '@/lib/supabase/client'

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

// Filled-pill priority badge — used in the drawer header
const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  'High':   { bg: '#EF4444', text: '#FFFFFF' },
  'Medium': { bg: '#F59E0B', text: '#FFFFFF' },
  'Low':    { bg: '#94A3B8', text: '#FFFFFF' },
}

// Soft-fill type badge — each task type gets a distinct hue
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'Design':          { bg: '#EEF2FF', text: '#3730A3' },
  'Engineering':     { bg: '#DBEAFE', text: '#1E40AF' },
  'Permitting':      { bg: '#FEF3C7', text: '#92400E' },
  'Interconnection': { bg: '#D1FAE5', text: '#047857' },
  'Financial':       { bg: '#FCE7F3', text: '#9D174D' },
  'Legal':           { bg: '#E0E7FF', text: '#4338CA' },
  'Construction':    { bg: '#FFEDD5', text: '#9A3412' },
  'Operations':      { bg: '#F1F5F9', text: '#475569' },
  'Administrative':  { bg: '#F3F4F6', text: '#374151' },
}

const KANBAN_COLUMNS = ['Draft', 'Pending Info', 'Ready to Start', 'In Progress', 'Under Review', 'Complete']
const ALL_STATUSES = ['Draft', 'Pending Info', 'Ready to Start', 'In Progress', 'Under Review', 'Complete']
const TASK_TYPES = ['Design', 'Engineering', 'Permitting', 'Interconnection', 'Financial', 'Legal', 'Construction', 'Operations', 'Administrative']

// Render a human-readable activity sentence from an activity_log entry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeActivity(a: any): string {
  const m = a.metadata ?? {}
  switch (a.action) {
    case 'status_changed':
      return `moved status from ${m.from || '—'} → ${m.to || '—'}`
    case 'priority_changed':
      return `changed priority from ${m.from || '—'} → ${m.to || '—'}`
    case 'assignee_changed':
      if (!m.to) return `unassigned the task`
      return `assigned the task to ${m.to_name || 'someone'}`
    case 'approver_changed':
      if (!m.to) return `removed the approver`
      return `set approver to ${m.to_name || 'someone'}`
    case 'approval_status_changed':
      if (m.to === 'Approved') return `approved the task`
      if (m.to === 'Changes Requested') return `requested changes`
      return `changed approval status to ${m.to}`
    case 'due_date_changed':
      return `set due date to ${m.to || '—'}`
    case 'title_changed':
      return `renamed the task to "${m.to}"`
    default:
      return a.action.replace(/_/g, ' ')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TasksClient({ tasks: initialTasks, projects, users }: { tasks: any[]; projects: any[]; users: any[] }) {
  const router = useRouter()
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  // List view: group + sort
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'assignee' | 'priority' | 'type' | 'project'>('none')
  const [sortBy, setSortBy] = useState<'default' | 'due_date' | 'priority'>('default')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  // Kanban drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // Comment state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)

  // Activity state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activity, setActivity] = useState<any[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

  // Files state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [files, setFiles] = useState<any[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [showAddFile, setShowAddFile] = useState(false)
  const [addFileMode, setAddFileMode] = useState<'upload' | 'link'>('upload')
  const [newFileUrl, setNewFileUrl] = useState('')
  const [newFileLinkName, setNewFileLinkName] = useState('')
  const [savingFile, setSavingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  // Drawer edit state
  const [editingDrawer, setEditingDrawer] = useState(false)
  const [savingDrawer, setSavingDrawer] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '', description: '', type: 'Administrative', priority: 'Medium',
    project_id: '', assignee_id: '', approver_id: '',
    requires_approval: false, due_date: '',
  })

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

  const openCount = initialTasks.filter(t => t.status !== 'Complete').length
  const completeCount = initialTasks.filter(t => t.status === 'Complete').length

  const filtered = useMemo(() => initialTasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || t.status === statusFilter
    const matchType = typeFilter === 'All' || t.type === typeFilter
    const matchProject = projectFilter === 'All' || t.project_id === projectFilter
    const matchAssignee = assigneeFilter === 'All' || t.assignee?.full_name === assigneeFilter
    return matchSearch && matchStatus && matchType && matchProject && matchAssignee
  }), [initialTasks, search, statusFilter, typeFilter, projectFilter, assigneeFilter])

  const PRIORITY_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 }

  // Sort + group derivations (used by list view only)
  const sortedFiltered = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'due_date') {
      arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1  // nulls last
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
    } else if (sortBy === 'priority') {
      arr.sort((a, b) => (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0))
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortBy])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groups: Record<string, any[]> = {}
    for (const t of sortedFiltered) {
      let key = '—'
      if (groupBy === 'status') key = t.status || '—'
      else if (groupBy === 'assignee') key = t.assignee?.full_name || 'Unassigned'
      else if (groupBy === 'priority') key = t.priority || '—'
      else if (groupBy === 'type') key = t.type || '—'
      else if (groupBy === 'project') key = t.project?.name || 'No project'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    // Determine ordered keys
    const keys = Object.keys(groups)
    if (groupBy === 'status') keys.sort((a, b) => ALL_STATUSES.indexOf(a) - ALL_STATUSES.indexOf(b))
    else if (groupBy === 'priority') keys.sort((a, b) => (PRIORITY_RANK[b] || 0) - (PRIORITY_RANK[a] || 0))
    else keys.sort()
    return { groups, keys }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedFiltered, groupBy])

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

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

  const loadActivity = useCallback(async (taskId: string) => {
    setLoadingActivity(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/activity`)
      if (res.ok) setActivity(await res.json())
    } catch { /* ignore */ }
    setLoadingActivity(false)
  }, [])

  const loadFiles = useCallback(async (taskId: string) => {
    setLoadingFiles(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/files`)
      if (res.ok) setFiles(await res.json())
    } catch { /* ignore */ }
    setLoadingFiles(false)
  }, [])

  async function uploadFile(file: File) {
    if (!selectedTask) return
    setSavingFile(true)
    setFileError(null)
    setUploadProgress('Uploading…')
    try {
      const browserSb = createBrowserClient()
      // Path format: {task_id}/{timestamp}-{sanitized-name}
      const safeName = file.name.replace(/[^\w.\-]+/g, '_')
      const storagePath = `${selectedTask}/${Date.now()}-${safeName}`

      const { error: upErr } = await browserSb.storage
        .from('task-files')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })

      if (upErr) {
        setFileError(`Upload failed: ${upErr.message}`)
        setUploadProgress(null)
        setSavingFile(false)
        return
      }

      setUploadProgress('Saving…')
      const res = await fetch(`/api/tasks/${selectedTask}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          storage_path: storagePath,
          file_size: file.size,
          content_type: file.type || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setFiles(prev => [created, ...prev])
        setShowAddFile(false)
      } else {
        const body = await res.json().catch(() => ({}))
        setFileError(body?.error || `Failed to save metadata (${res.status})`)
        // Best-effort: delete the orphaned blob
        try { await browserSb.storage.from('task-files').remove([storagePath]) } catch { /* ignore */ }
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Network error')
    }
    setSavingFile(false)
    setUploadProgress(null)
  }

  async function addFileLink() {
    if (!selectedTask || !newFileLinkName.trim() || !newFileUrl.trim()) return
    setSavingFile(true)
    setFileError(null)
    try {
      const res = await fetch(`/api/tasks/${selectedTask}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_name: newFileLinkName.trim(), file_url: newFileUrl.trim() }),
      })
      if (res.ok) {
        const created = await res.json()
        setFiles(prev => [created, ...prev])
        setNewFileLinkName(''); setNewFileUrl(''); setShowAddFile(false)
      } else {
        const body = await res.json().catch(() => ({}))
        setFileError(body?.error || `Failed (${res.status})`)
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Network error')
    }
    setSavingFile(false)
  }

  async function deleteFile(fileId: string) {
    if (!selectedTask) return
    const res = await fetch(`/api/tasks/${selectedTask}/files/${fileId}`, { method: 'DELETE' })
    if (res.ok) setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // Open a Supabase-stored file via signed URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function downloadStoredFile(file: any) {
    if (!selectedTask) return
    try {
      const res = await fetch(`/api/tasks/${selectedTask}/files/${file.id}/download`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body?.error || 'Could not get download URL')
        return
      }
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Network error')
    }
  }

  useEffect(() => {
    if (selectedTask) {
      loadComments(selectedTask)
      loadActivity(selectedTask)
      loadFiles(selectedTask)
    } else {
      setComments([])
      setActivity([])
      setFiles([])
    }
    // Reset edit state when selection changes
    setEditingDrawer(false)
    setEditError(null)
    setShowAddFile(false)
    setFileError(null)
  }, [selectedTask, loadComments, loadActivity, loadFiles])

  function startDrawerEdit() {
    if (!selected) return
    setEditForm({
      title: selected.title ?? '',
      description: selected.description ?? '',
      type: selected.type ?? 'Administrative',
      priority: selected.priority ?? 'Medium',
      project_id: selected.project_id ?? '',
      assignee_id: selected.assignee_id ?? '',
      approver_id: selected.approver_id ?? '',
      requires_approval: !!selected.requires_approval,
      due_date: selected.due_date ? String(selected.due_date).slice(0, 10) : '',
    })
    setEditingDrawer(true)
    setEditError(null)
  }

  async function saveDrawerEdit() {
    if (!selected) return
    if (!editForm.title.trim()) { setEditError('Title is required'); return }
    setSavingDrawer(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/tasks/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description || null,
          type: editForm.type,
          priority: editForm.priority,
          project_id: editForm.project_id || null,
          assignee_id: editForm.assignee_id || null,
          approver_id: editForm.requires_approval ? (editForm.approver_id || null) : null,
          requires_approval: editForm.requires_approval,
          due_date: editForm.due_date || null,
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

  async function handleCreateTask() {
    if (!form.title || !form.project_id) return
    setSaving(true)
    setCreateError(null)
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
      } else {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error || `Request failed with ${res.status}`
        console.error('Create task failed:', msg, body)
        setCreateError(msg)
      }
    } catch (err) {
      console.error('Create task error:', err)
      setCreateError(err instanceof Error ? err.message : 'Network error')
    }
    setSaving(false)
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
    if (selectedTask === taskId) loadActivity(taskId)
  }

  async function handleApprove(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_status: 'Approved', status: 'Complete' }),
    })
    router.refresh()
    if (selectedTask === taskId) loadActivity(taskId)
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
    if (selectedTask === taskId) loadActivity(taskId)
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

  const assigneeNames = ['All', ...Array.from(new Set(initialTasks.map(t => t.assignee?.full_name).filter(Boolean) as string[]))]

  return (
    <div>
      {/* Sticky header bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-7 py-4 flex items-center gap-2.5 flex-wrap sticky top-[52px] z-30">
        <div className="mr-1">
          <div className="text-lg font-bold text-[#3E3E3C]">Task Tracker</div>
          <div className="text-xs text-[#3E3E3C] mt-0.5">{openCount} open · {completeCount} complete</div>
        </div>
        {/* List/Kanban pill toggle */}
        <div className="flex bg-[#f1f5f9] rounded-[9px] p-[3px] gap-0.5 mr-1">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[12.5px] font-semibold transition-all"
            style={{
              background: view === 'list' ? 'white' : 'transparent',
              color: view === 'list' ? '#181818' : '#706E6B',
              boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => setView('kanban')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[12.5px] font-semibold transition-all"
            style={{
              background: view === 'kanban' ? 'white' : 'transparent',
              color: view === 'kanban' ? '#181818' : '#706E6B',
              boxShadow: view === 'kanban' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}
          >
            <LayoutGrid size={13} /> Kanban
          </button>
        </div>
        {/* Filters */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#706E6B]" />
          <input type="text" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-7 pr-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] focus:outline-none w-[170px] bg-white" />
        </div>
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white">
          <option value="All">All Projects</option>
          {projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white">
          {statuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white">
          {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white">
          {assigneeNames.map(a => <option key={a} value={a}>{a === 'All' ? 'All Assignees' : a.split(' ')[0]}</option>)}
        </select>
        {view === 'list' && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0] mx-0.5" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#706E6B] uppercase tracking-wider">Sort</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'default' | 'due_date' | 'priority')}
                className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white"
              >
                <option value="default">Default</option>
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#706E6B] uppercase tracking-wider">Group</span>
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as 'none' | 'status' | 'assignee' | 'priority' | 'type' | 'project')}
                className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-[13px] bg-white"
              >
                <option value="none">None</option>
                <option value="status">Status</option>
                <option value="assignee">Assignee</option>
                <option value="priority">Priority</option>
                <option value="type">Type</option>
                <option value="project">Project</option>
              </select>
            </div>
          </>
        )}
        <button onClick={() => setShowNewModal(true)}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-[#70A0D0] text-white rounded-lg text-[13px] font-semibold hover:bg-[#2C5485] transition-colors">
          <Plus size={14} /> New Task
        </button>
      </div>

      <div className="px-7 py-5">
        <div>
          {view === 'list' ? (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] bg-[#fafafa]">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Task</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Type</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Status</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Assignee</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Approver</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Due</th>
                    <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const renderRow = (task: any) => {
                      const sc = STATUS_COLORS[task.status] ?? { bg: '#F8FAFC', text: '#475569' }
                      return (
                        <tr key={task.id} className={`border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer ${selectedTask === task.id ? 'bg-[#EFF6FF]' : ''}`}
                          onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#94a3b8' }} />
                              <span className="font-medium text-[#181818]">{task.title}</span>
                              {task.requires_approval && (
                                <span className="text-[10px] bg-[#FDF4FF] text-[#7e22ce] px-1.5 py-0.5 rounded">Approval</span>
                              )}
                            </div>
                            {task.project && <p className="text-xs text-[#706E6B] mt-0.5 ml-3.5">{task.project.name}</p>}
                          </td>
                          <td className="px-3 py-3 text-[#3E3E3C]">{task.type}</td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{task.status}</span>
                          </td>
                          <td className="px-3 py-3">
                            {task.assignee?.full_name ? <Avatar name={task.assignee.full_name} size="sm" /> : <span className="text-xs text-[#A8A8A8]">—</span>}
                          </td>
                          <td className="px-3 py-3">
                            {task.requires_approval && task.approver?.full_name
                              ? <Avatar name={task.approver.full_name} size="sm" />
                              : <span className="text-xs text-[#A8A8A8]">—</span>}
                          </td>
                          <td className="px-3 py-3 text-xs text-[#3E3E3C]">{formatDate(task.due_date)}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] ?? '#94a3b8' }} />
                              <span className="text-xs text-[#3E3E3C]">{task.priority}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    if (sortedFiltered.length === 0) {
                      return <tr><td colSpan={7} className="text-center py-12 text-[#706E6B] text-sm">No tasks match your filters.</td></tr>
                    }

                    if (!grouped) {
                      return sortedFiltered.map(renderRow)
                    }

                    // Grouped rendering — group header rows + collapsible task rows
                    const rows: React.ReactNode[] = []
                    for (const key of grouped.keys) {
                      const groupTasks = grouped.groups[key]
                      const isCollapsed = collapsedGroups[key]
                      rows.push(
                        <tr key={`group-${key}`} className="border-b border-[#e2e8f0] cursor-pointer"
                          style={{ background: 'linear-gradient(90deg,#f0f4f8,#fafbfc)' }}
                          onClick={() => toggleGroup(key)}>
                          <td colSpan={7} className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <ChevronDown
                                size={12}
                                className="text-[#706E6B] transition-transform flex-shrink-0"
                                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
                              />
                              <span className="text-[12.5px] font-bold text-[#181818]">{key}</span>
                              <span className="text-[11.5px] text-[#706E6B] font-medium">
                                {groupTasks.length} task{groupTasks.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                      if (!isCollapsed) {
                        for (const t of groupTasks) rows.push(renderRow(t))
                      }
                    }
                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {KANBAN_COLUMNS.map(col => {
                const colTasks = filtered.filter(t => t.status === col)
                const isDragOver = dragOverCol === col
                return (
                  <div
                    key={col}
                    className="w-64 flex-shrink-0"
                    onDragOver={e => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (dragOverCol !== col) setDragOverCol(col)
                    }}
                    onDragLeave={e => {
                      // Only clear if we left the column entirely
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return
                      if (dragOverCol === col) setDragOverCol(null)
                    }}
                    onDrop={e => {
                      e.preventDefault()
                      const taskId = e.dataTransfer.getData('text/task-id')
                      const fromStatus = e.dataTransfer.getData('text/task-status')
                      setDragOverCol(null)
                      setDraggingId(null)
                      if (taskId && fromStatus !== col) {
                        updateTaskStatus(taskId, col)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-[12px] font-semibold text-[#181818]">{col}</span>
                      <span className="text-[11px] text-[#706E6B] bg-[#F3F2F2] px-1.5 rounded-full font-medium">{colTasks.length}</span>
                    </div>
                    <div
                      className="space-y-2 p-1 rounded-lg transition-colors min-h-[40px]"
                      style={{
                        background: isDragOver ? 'rgba(112,160,208,0.08)' : 'transparent',
                        outline: isDragOver ? '2px dashed #70A0D0' : '2px dashed transparent',
                      }}
                    >
                      {colTasks.map(task => {
                        const dragging = draggingId === task.id
                        const typeC = TYPE_COLORS[task.type] ?? TYPE_COLORS['Administrative']
                        const isHigh = task.priority === 'High'
                        return (
                          <div
                            key={task.id}
                            className="card p-3 hover:shadow-md transition-all"
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/task-id', task.id)
                              e.dataTransfer.setData('text/task-status', task.status)
                              e.dataTransfer.effectAllowed = 'move'
                              setDraggingId(task.id)
                            }}
                            onDragEnd={() => {
                              setDraggingId(null)
                              setDragOverCol(null)
                            }}
                            onClick={() => { if (!dragging) setSelectedTask(task.id) }}
                            style={{
                              borderLeft: `3px solid ${typeC.text}`,
                              cursor: dragging ? 'grabbing' : 'grab',
                              opacity: dragging ? 0.4 : 1,
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: typeC.bg, color: typeC.text }}>{task.type}</span>
                              {isHigh && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#EF4444', color: 'white' }}>High</span>
                              )}
                              {task.due_date && <span className="text-[10px] text-[#706E6B] ml-auto">{formatDate(task.due_date)}</span>}
                            </div>
                            <p className="text-sm font-medium text-[#181818] leading-tight mb-2">{task.title}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[#706E6B] truncate">{task.project?.name}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {task.assignee?.full_name && <Avatar name={task.assignee.full_name} size="sm" />}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* Task Detail — full-record drawer */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setSelectedTask(null)}
          />
          {/* Right-side drawer */}
          <div className="fixed top-[52px] right-0 bottom-0 z-50 bg-white w-full max-w-[720px] shadow-2xl flex flex-col">
            {/* Header — light surface */}
            <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-[#706E6B] uppercase tracking-[0.08em]">Task</span>
                    {(() => {
                      const t = editingDrawer ? editForm.type : selected.type
                      const tc = TYPE_COLORS[t] ?? TYPE_COLORS['Administrative']
                      return (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: tc.bg, color: tc.text }}>{t}</span>
                      )
                    })()}
                    {(() => {
                      const p = editingDrawer ? editForm.priority : selected.priority
                      const pc = PRIORITY_BADGE[p] ?? PRIORITY_BADGE['Medium']
                      return (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: pc.bg, color: pc.text }}>{p}</span>
                      )
                    })()}
                  </div>
                  {editingDrawer ? (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full text-[18px] font-semibold text-[#181818] leading-tight bg-white border border-[#cbd5e1] rounded px-2 py-1 placeholder-[#A8A8A8] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      placeholder="Task title"
                    />
                  ) : (
                    <h2 className="text-[18px] font-semibold text-[#181818] leading-tight">{selected.title}</h2>
                  )}
                  {selected.project && !editingDrawer && (
                    <p className="text-[12.5px] text-[#3E3E3C] mt-1">{selected.project.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingDrawer ? (
                    <>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete task "${selected.title}"?`)) return
                          const res = await fetch(`/api/tasks/${selected.id}`, { method: 'DELETE' })
                          if (res.ok) { setSelectedTask(null); router.refresh() }
                          else { const b = await res.json().catch(() => ({})); setEditError(b?.error || 'Delete failed') }
                        }}
                        disabled={savingDrawer}
                        title="Delete task"
                        className="px-2.5 py-1 text-[12px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] rounded inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                      <button
                        onClick={() => { setEditingDrawer(false); setEditError(null) }}
                        disabled={savingDrawer}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDrawerEdit}
                        disabled={savingDrawer}
                        className="btn-primary"
                      >
                        {savingDrawer ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startDrawerEdit}
                      title="Edit task"
                      className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button onClick={() => setSelectedTask(null)} className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Status Path — sequential chevron steps */}
              <div className="flex items-center overflow-x-auto">
                {(() => {
                  const currentIdx = ALL_STATUSES.indexOf(selected.status)
                  return ALL_STATUSES.map((s, i) => {
                    const isCurrent = i === currentIdx
                    const isDone = i < currentIdx
                    const isFirst = i === 0
                    let bg = '#F1F5F9', color = '#706E6B', borderTint = ''
                    if (isDone) { bg = '#94A8BD'; color = '#FFFFFF' }
                    if (isCurrent) { bg = '#2C5485'; color = '#FFFFFF'; borderTint = '0 1px 0 #1C303C inset' }
                    return (
                      <button
                        key={s}
                        onClick={() => updateTaskStatus(selected.id, s)}
                        className="whitespace-nowrap text-[11px] font-semibold flex items-center justify-center hover:brightness-110 transition-all"
                        style={{
                          background: bg,
                          color,
                          height: 30,
                          paddingLeft: isFirst ? 14 : 22,
                          paddingRight: 18,
                          marginLeft: isFirst ? 0 : -9,
                          clipPath: isFirst
                            ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
                            : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)',
                          boxShadow: borderTint || undefined,
                          flex: '0 0 auto',
                        }}
                      >
                        {s}
                      </button>
                    )
                  })
                })()}
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 bg-[#fafbfc]">
              {editingDrawer ? (
                /* Edit form — replaces meta + description in edit mode */
                <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden mb-5">
                  <div className="px-4 py-3 bg-[#F3F2F2] border-b border-[#e2e8f0]">
                    <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Edit Task Details</h3>
                  </div>
                  <div className="px-5 py-5 grid grid-cols-2 gap-x-5 gap-y-4">
                    <div className="col-span-2">
                      <label className="label block mb-1">Project</label>
                      <select
                        value={editForm.project_id}
                        onChange={e => setEditForm(f => ({ ...f, project_id: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      >
                        <option value="">— Select project —</option>
                        {projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Type</label>
                      <select
                        value={editForm.type}
                        onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      >
                        {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Priority</label>
                      <select
                        value={editForm.priority}
                        onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      >
                        <option>High</option>
                        <option>Medium</option>
                        <option>Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Assignee</label>
                      <select
                        value={editForm.assignee_id}
                        onChange={e => setEditForm(f => ({ ...f, assignee_id: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label block mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                        className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="drawer_requires_approval"
                        checked={editForm.requires_approval}
                        onChange={e => setEditForm(f => ({ ...f, requires_approval: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#cbd5e1] text-[#70A0D0] focus:ring-[#70A0D0]"
                      />
                      <label htmlFor="drawer_requires_approval" className="text-[13px] text-[#181818] font-medium cursor-pointer select-none">
                        Requires approval before completion
                      </label>
                    </div>
                    {editForm.requires_approval && (
                      <div className="col-span-2">
                        <label className="label block mb-1">Approver</label>
                        <select
                          value={editForm.approver_id}
                          onChange={e => setEditForm(f => ({ ...f, approver_id: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                        >
                          <option value="">— Select approver —</option>
                          {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="label block mb-1">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Add additional context (optional)"
                        rows={4}
                        className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] resize-none focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                      />
                    </div>
                  </div>
                  {editError && (
                    <div className="px-5 py-2.5 bg-[#fef2f2] border-t border-[#fecaca] text-[12px] text-[#991b1b]">
                      {editError}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Meta grid */}
                  <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden mb-5">
                    <div className="grid grid-cols-2 divide-x divide-[#f1f5f9]">
                      <div className="px-4 py-3">
                        <p className="label mb-1">Assignee</p>
                        {selected.assignee?.full_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={selected.assignee.full_name} size="sm" />
                            <span className="text-sm text-[#181818] font-medium">{selected.assignee.full_name}</span>
                          </div>
                        ) : <span className="text-sm text-[#706E6B]">Unassigned</span>}
                      </div>
                      <div className="px-4 py-3">
                        <p className="label mb-1">Approver</p>
                        {selected.requires_approval && selected.approver?.full_name ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={selected.approver.full_name} size="sm" />
                            <span className="text-sm text-[#181818] font-medium">{selected.approver.full_name}</span>
                          </div>
                        ) : <span className="text-sm text-[#A8A8A8] italic">Not required</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-[#f1f5f9] border-t border-[#f1f5f9]">
                      <div className="px-4 py-3">
                        <p className="label mb-1">Due Date</p>
                        <p className="text-sm font-medium text-[#181818]">{formatDate(selected.due_date)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="label mb-1">Created</p>
                        <p className="text-sm font-medium text-[#181818]">{formatDate(selected.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {selected.description && (
                    <div className="mb-5">
                      <p className="label mb-2">Description</p>
                      <p className="text-sm text-[#181818] bg-white border border-[#e2e8f0] rounded-lg p-3.5 whitespace-pre-wrap">{selected.description}</p>
                    </div>
                  )}
                </>
              )}

              {/* Approval */}
              {selected.requires_approval && (
                <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg p-4">
                  <p className="label mb-2.5">Approval</p>
                  {selected.approval_status === 'Approved' ? (
                    <div className="flex items-center gap-2 text-[#166534]">
                      <CheckCircle size={14} />
                      <span className="text-sm font-medium">Approved</span>
                    </div>
                  ) : selected.approval_status === 'Changes Requested' ? (
                    <div>
                      <p className="text-sm text-[#dc2626] font-medium mb-1.5">Changes Requested</p>
                      {selected.approval_notes && <p className="text-xs text-[#dc2626] bg-[#FEF2F2] p-2.5 rounded">{selected.approval_notes}</p>}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(selected.id)}
                        className="text-xs px-3 py-1.5 bg-[#166534] text-white rounded-lg hover:bg-[#15803d] transition-colors font-semibold">
                        ✓ Approve
                      </button>
                      <button onClick={() => handleRequestChanges(selected.id)}
                        className="text-xs px-3 py-1.5 bg-white text-[#dc2626] border border-[#dc2626] rounded-lg hover:bg-[#FEF2F2] transition-colors font-semibold">
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Files */}
              <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip size={14} className="text-[#3E3E3C]" />
                    <span className="text-[13px] font-semibold text-[#181818]">Files</span>
                    <span className="text-[11px] text-[#706E6B]">{files.length}</span>
                  </div>
                  {!showAddFile && (
                    <button onClick={() => setShowAddFile(true)} className="btn-secondary">
                      <Plus size={12} /> Attach
                    </button>
                  )}
                </div>
                <div className="px-4 py-3">
                  {showAddFile && (
                    <div className="mb-3 p-3 bg-[#fafbfc] border border-[#e2e8f0] rounded-lg">
                      {/* Mode toggle */}
                      <div className="flex bg-[#f1f5f9] rounded-md p-0.5 mb-3 w-fit">
                        <button
                          onClick={() => setAddFileMode('upload')}
                          className="flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-semibold rounded transition-all"
                          style={{
                            background: addFileMode === 'upload' ? 'white' : 'transparent',
                            color: addFileMode === 'upload' ? '#181818' : '#706E6B',
                            boxShadow: addFileMode === 'upload' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          <Upload size={11} /> Upload
                        </button>
                        <button
                          onClick={() => setAddFileMode('link')}
                          className="flex items-center gap-1.5 px-3 py-1 text-[11.5px] font-semibold rounded transition-all"
                          style={{
                            background: addFileMode === 'link' ? 'white' : 'transparent',
                            color: addFileMode === 'link' ? '#181818' : '#706E6B',
                            boxShadow: addFileMode === 'link' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                          }}
                        >
                          <ExternalLink size={11} /> Link
                        </button>
                      </div>

                      {addFileMode === 'upload' ? (
                        <div className="space-y-2">
                          <label className="block">
                            <input
                              type="file"
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) uploadFile(f)
                              }}
                              disabled={savingFile}
                              className="block w-full text-[12px] text-[#3E3E3C] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-[#70A0D0] file:text-white hover:file:bg-[#2C5485] file:cursor-pointer cursor-pointer"
                            />
                          </label>
                          {uploadProgress && <p className="text-[11px] text-[#3E3E3C]">{uploadProgress}</p>}
                          {fileError && <p className="text-[11px] text-[#991b1b]">{fileError}</p>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newFileLinkName}
                            onChange={e => setNewFileLinkName(e.target.value)}
                            placeholder="File name (e.g., Site Plan v2.pdf)"
                            className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                          />
                          <input
                            type="url"
                            value={newFileUrl}
                            onChange={e => setNewFileUrl(e.target.value)}
                            placeholder="URL (Box, Drive, Dropbox, etc.)"
                            className="w-full px-3 py-1.5 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                          />
                          {fileError && <p className="text-[11px] text-[#991b1b]">{fileError}</p>}
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => { setShowAddFile(false); setNewFileLinkName(''); setNewFileUrl(''); setFileError(null) }}
                              disabled={savingFile}
                              className="px-3 py-1 text-[12px] text-[#3E3E3C] hover:text-[#181818]"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={addFileLink}
                              disabled={savingFile || !newFileLinkName.trim() || !newFileUrl.trim()}
                              className="btn-primary text-[12px]"
                            >
                              {savingFile ? 'Saving…' : 'Add Link'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {loadingFiles ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : files.length === 0 ? (
                    <p className="text-xs text-[#706E6B] py-2">No files attached yet.</p>
                  ) : (
                    <ul className="divide-y divide-[#f1f5f9]">
                      {files.map(f => {
                        const isStored = !!f.storage_path
                        const sizeKb = f.file_size ? (f.file_size / 1024).toFixed(0) : null
                        const sizeLabel = sizeKb ? (Number(sizeKb) > 1024 ? `${(Number(sizeKb) / 1024).toFixed(1)} MB` : `${sizeKb} KB`) : null
                        return (
                          <li key={f.id} className="flex items-center gap-3 py-2.5">
                            <div className="w-8 h-8 rounded bg-[#F3F2F2] flex items-center justify-center flex-shrink-0">
                              <Paperclip size={14} className="text-[#3E3E3C]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-[#181818] truncate">{f.file_name}</p>
                              <p className="text-[10.5px] text-[#706E6B]">
                                {f.uploader?.full_name ?? 'Someone'} · {formatDate(f.uploaded_at)}
                                {sizeLabel && <span> · {sizeLabel}</span>}
                                {!isStored && f.file_url && <span> · external</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isStored ? (
                                <button
                                  onClick={() => downloadStoredFile(f)}
                                  className="p-1.5 text-[#3E3E3C] hover:text-[#2C5485] hover:bg-[#F3F2F2] rounded transition-colors"
                                  title="Download"
                                >
                                  <Download size={13} />
                                </button>
                              ) : f.file_url ? (
                                <a
                                  href={f.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-[#3E3E3C] hover:text-[#2C5485] hover:bg-[#F3F2F2] rounded transition-colors"
                                  title="Open external link"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              ) : null}
                              <button
                                onClick={() => deleteFile(f.id)}
                                className="p-1.5 text-[#3E3E3C] hover:text-[#dc2626] hover:bg-[#fef2f2] rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Threads (was Discussion) */}
              <div className="mb-5 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#3E3E3C]" />
                    <span className="text-[13px] font-semibold text-[#181818]">Threads</span>
                    <span className="text-[11px] text-[#706E6B]">{comments.length}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E8F5EA] text-[#1E7B3A]" title="This thread mirrors into Slack">
                    <Slack size={10} /> Slack linked
                  </span>
                </div>
                <div className="px-4 py-3">
                  {loadingComments ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : (
                    <div className="space-y-3 mb-3">
                      {comments.map(c => (
                        <div key={c.id} className="flex gap-2.5">
                          <Avatar name={c.user?.full_name ?? 'User'} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-[#181818]">{c.user?.full_name ?? 'User'}</span>
                              <span className="text-[10.5px] text-[#706E6B]">{formatDate(c.created_at)}</span>
                            </div>
                            <p className="text-[13px] text-[#181818] mt-0.5">{c.message}</p>
                          </div>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-xs text-[#706E6B] py-2">No messages yet — be the first to start a thread.</p>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
                      placeholder="Add a message..." className="flex-1 px-3 py-2 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
                    <button onClick={sendComment} className="p-2 bg-[#70A0D0] text-white rounded hover:bg-[#2C5485] transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Activity feed */}
              <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center gap-2">
                  <Activity size={14} className="text-[#3E3E3C]" />
                  <span className="text-[13px] font-semibold text-[#181818]">Activity</span>
                  <span className="text-[11px] text-[#706E6B]">{activity.length}</span>
                </div>
                <div className="px-4 py-3">
                  {loadingActivity ? (
                    <p className="text-xs text-[#706E6B]">Loading...</p>
                  ) : activity.length === 0 ? (
                    <p className="text-xs text-[#706E6B] py-2">No activity yet — changes to this task will appear here.</p>
                  ) : (
                    <ul className="space-y-3">
                      {activity.map(a => (
                        <li key={a.id} className="flex gap-2.5 text-[13px]">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#70A0D0] mt-[7px] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[#181818]">
                              <span className="font-semibold">{a.user?.full_name ?? 'Someone'}</span>{' '}
                              {describeActivity(a)}
                            </p>
                            <p className="text-[10.5px] text-[#706E6B] mt-0.5">{formatDate(a.created_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Task Modal — Lightning-style */}
      {showNewModal && (
        <div className="fixed inset-0 bg-[#080A0F]/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowNewModal(false); setCreateError(null) }}>
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #2C5485 0%, #70A0D0 100%)' }}>
              <div>
                <div className="text-[11px] font-semibold text-white/75 uppercase tracking-[0.08em]">Task</div>
                <h2 className="text-[17px] font-semibold text-white mt-0.5">New Task</h2>
              </div>
              <button onClick={() => { setShowNewModal(false); setCreateError(null) }} className="text-white/70 hover:text-white p-1 rounded transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body — sections */}
            <div className="overflow-y-auto flex-1 bg-[#fafbfc]">
              {/* Section: Task Details */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Task Details</h3>
                </div>
                <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4 bg-white">
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5"><span className="text-[#dc2626] mr-0.5">*</span>Project</label>
                    <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option value="">— Select project —</option>
                      {projects.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5"><span className="text-[#dc2626] mr-0.5">*</span>Title</label>
                    <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="Task title" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Priority</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Description</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] h-20 resize-none focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all"
                      placeholder="Add additional context (optional)" />
                  </div>
                </div>
              </div>

              {/* Section: Assignment */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Assignment</h3>
                </div>
                <div className="px-6 py-5 bg-white space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Assignee</label>
                    <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                      <option value="">Unassigned</option>
                      {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={form.requires_approval}
                        onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#cbd5e1] text-[#3E3E3C] focus:ring-[#70A0D0]" />
                      <span className="text-[13px] text-[#181818] font-medium">Requires approval before completion</span>
                    </label>
                  </div>
                  {form.requires_approval && (
                    <div>
                      <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Approver</label>
                      <select value={form.approver_id} onChange={e => setForm(f => ({ ...f, approver_id: e.target.value }))}
                        className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] bg-white focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 transition-all">
                        <option value="">— Select approver —</option>
                        {users.map((u: { id: string; full_name: string }) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Timeline */}
              <div>
                <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
                  <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">Timeline</h3>
                </div>
                <div className="px-6 py-5 bg-white">
                  <div className="w-1/2">
                    <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Due Date</label>
                    <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
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
              <button onClick={handleCreateTask} disabled={saving || !form.title || !form.project_id}
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
