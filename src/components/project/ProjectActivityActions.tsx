'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StickyNote, Calendar, Paperclip, CheckSquare, X } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

const TASK_TYPES = ['Design', 'Engineering', 'Permitting', 'Interconnection', 'Financial', 'Legal', 'Construction', 'Operations', 'Administrative']

interface User { id: string; full_name: string }

type Action = 'task' | 'note' | 'event' | 'file' | null

export function ProjectActivityActions({ projectId, projectName, users }: { projectId: string; projectName: string; users: User[] }) {
  const [active, setActive] = useState<Action>(null)
  const [showTaskModal, setShowTaskModal] = useState(false)

  return (
    <div className="card overflow-hidden mb-4">
      <div className="px-4 py-2.5 border-b border-[#f1f5f9] flex items-center gap-1 flex-wrap">
        <ActionButton icon={<CheckSquare size={13} />} label="Add Task" active={false} onClick={() => setShowTaskModal(true)} />
        <ActionButton icon={<StickyNote size={13} />} label="Add Note" active={active === 'note'} onClick={() => setActive(a => a === 'note' ? null : 'note')} />
        <ActionButton icon={<Calendar size={13} />} label="Add Event" active={active === 'event'} onClick={() => setActive(a => a === 'event' ? null : 'event')} />
        <ActionButton icon={<Paperclip size={13} />} label="Add File" active={active === 'file'} onClick={() => setActive(a => a === 'file' ? null : 'file')} />
      </div>
      {active && active !== 'task' && (
        <div className="px-4 py-4 bg-[#fafbfc] border-b border-[#f1f5f9]">
          {active === 'note' && <NoteForm projectId={projectId} type="note" onClose={() => setActive(null)} />}
          {active === 'event' && <NoteForm projectId={projectId} type="event" onClose={() => setActive(null)} />}
          {active === 'file' && <FileForm projectId={projectId} onClose={() => setActive(null)} />}
        </div>
      )}
      {showTaskModal && (
        <NewTaskModal projectId={projectId} projectName={projectName} users={users} onClose={() => setShowTaskModal(false)} />
      )}
    </div>
  )
}

function ActionButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12.5px] font-medium transition-colors ${active ? 'bg-[#EFF6FF] text-[#1d4ed8]' : 'text-[#3E3E3C] hover:bg-[#f8fafc]'}`}>
      {icon}<span>{label}</span>
    </button>
  )
}

function CloseRow({ onClose, busy, onSubmit, label }: { onClose: () => void; busy: boolean; onSubmit: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 mt-3">
      <button onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
      <button onClick={onSubmit} disabled={busy} className="btn-primary">{busy ? 'Saving…' : label}</button>
    </div>
  )
}

// ── Full-featured New Task modal ─────────────────────────────────────
// Matches the modal on the /tasks page so users get the same fields here.
function NewTaskModal({ projectId, projectName, users, onClose }: { projectId: string; projectName: string; users: User[]; onClose: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '', description: '', type: 'Administrative', priority: 'Medium',
    assignee_id: '', approver_id: '', requires_approval: false,
    due_date: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (!form.title.trim()) { setErr('Title required'); return }
    setBusy(true); setErr(null)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        title: form.title,
        description: form.description || null,
        type: form.type,
        priority: form.priority,
        assignee_id: form.assignee_id || null,
        approver_id: form.requires_approval ? (form.approver_id || null) : null,
        requires_approval: form.requires_approval,
        due_date: form.due_date || null,
        status: 'Draft',
      }),
    })
    if (res.ok) { onClose(); router.refresh() }
    else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed') }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 bg-[#080A0F]/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[640px] max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #2C5485 0%, #70A0D0 100%)' }}>
          <div>
            <div className="text-[11px] font-semibold text-white/75 uppercase tracking-[0.08em]">Task on {projectName}</div>
            <h2 className="text-[17px] font-semibold text-white mt-0.5">New Task</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 bg-[#fafbfc]">
          {/* Task Details */}
          <SectionHeader>Task Details</SectionHeader>
          <div className="px-6 py-5 grid grid-cols-2 gap-x-5 gap-y-4 bg-white">
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5"><span className="text-[#dc2626] mr-0.5">*</span>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus
                placeholder="Task title"
                className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] bg-white">
                {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] bg-white">
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Description</label>
              <RichTextEditor
                value={form.description}
                onChange={html => setForm(f => ({ ...f, description: html }))}
                placeholder="Add additional context (optional)"
                minHeight={88}
              />
            </div>
          </div>

          {/* Assignment */}
          <SectionHeader>Assignment</SectionHeader>
          <div className="px-6 py-5 bg-white space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Assignee</label>
              <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
                className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] bg-white">
                <option value="">Unassigned</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={form.requires_approval}
                onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))}
                className="w-4 h-4 rounded border-[#cbd5e1] focus:ring-[#70A0D0]" />
              <span className="text-[13px] text-[#181818] font-medium">Requires approval before completion</span>
            </label>
            {form.requires_approval && (
              <div>
                <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Approver</label>
                <select value={form.approver_id} onChange={e => setForm(f => ({ ...f, approver_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] bg-white">
                  <option value="">— Select approver —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Timeline */}
          <SectionHeader>Timeline</SectionHeader>
          <div className="px-6 py-5 bg-white">
            <div className="w-1/2">
              <label className="block text-[12px] font-medium text-[#3E3E3C] mb-1.5">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px]" />
            </div>
          </div>

          {err && (
            <div className="px-6 py-3 bg-[#fef2f2] border-t border-[#fecaca] text-[12px] text-[#991b1b]">{err}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#f1f5f9] border-t border-[#e2e8f0] flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={busy || !form.title} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-2.5 bg-[#f1f5f9] border-y border-[#e2e8f0]">
      <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">{children}</h3>
    </div>
  )
}

// ── Note + Event form (shared) ───────────────────────────────────────
function NoteForm({ projectId, type, onClose }: { projectId: string; type: 'note' | 'event'; onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (type === 'event' && !eventDate) { setErr('Event date required'); return }
    if (!title.trim() && !body.trim()) { setErr('Add a title or note'); return }
    setBusy(true); setErr(null)
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, body, event_date: type === 'event' ? eventDate : null }),
    })
    if (res.ok) { onClose(); router.refresh() }
    else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Failed') }
    setBusy(false)
  }

  return (
    <div>
      {type === 'event' && (
        <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
          className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md mb-2" />
      )}
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'event' ? 'Event title' : 'Note title (optional)'} autoFocus
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md mb-2" />
      <RichTextEditor
        value={body}
        onChange={setBody}
        placeholder={type === 'event' ? 'Notes about this event' : 'Write a note…'}
        minHeight={96}
      />
      {err && <div className="mt-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      <CloseRow onClose={onClose} busy={busy} onSubmit={save} label={type === 'event' ? 'Add event' : 'Add note'} />
    </div>
  )
}

// ── File upload form ──────────────────────────────────────────────────
function FileForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (!file) { setErr('Pick a file'); return }
    setBusy(true); setErr(null)
    try {
      // Upload to Supabase Storage
      const path = `${projectId}/${Date.now()}-${file.name}`
      const { error: upErr } = await supabase.storage.from('project-files').upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'file',
          title: title || file.name,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
        }),
      })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error || 'Failed') }
      onClose(); router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    }
    setBusy(false)
  }

  return (
    <div>
      <label className="block">
        <span className="text-[11px] font-semibold text-[#3E3E3C]">File</span>
        <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-[12px] file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-[#EFF6FF] file:text-[#1d4ed8] file:font-semibold" />
      </label>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Label (optional)"
        className="mt-2 w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md" />
      {err && <div className="mt-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      <CloseRow onClose={onClose} busy={busy} onSubmit={save} label="Upload" />
    </div>
  )
}

// no-op exports to avoid warnings on unused symbols if we trim later
export { X as _IconX }
