'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Flag, CheckSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { RowDrawer, DrawerInput, DrawerSelect, DrawerTextarea, Section } from './_RowDrawer'

// ── Types ─────────────────────────────────────────────────────────
export interface Milestone {
  id: string
  project_id: string
  label: string
  target_date: string | null
  status: string  // Not Started | At Risk | Hit | Missed
  notes: string | null
  completed: boolean
  sort_order: number
}

export interface ScheduleTask {
  id: string
  project_id: string
  title: string
  type: string
  status: string
  priority: string
  start_date: string | null
  due_date: string | null
  end_date: string | null
  show_on_schedule: boolean
  parent_task_id: string | null
  assignee?: { full_name: string } | null
  _subtask_count?: number
}

interface Props {
  projectId: string
  milestones: Milestone[]
  scheduleTasks: ScheduleTask[]
}

// ── Styling helpers ────────────────────────────────────────────────
const MILESTONE_STATUSES = ['Not Started', 'At Risk', 'Hit', 'Missed']
const MILESTONE_PILL: Record<string, { bg: string; text: string }> = {
  'Not Started': { bg: '#F1F5F9', text: '#475569' },
  'At Risk':     { bg: '#FFF7ED', text: '#c2410c' },
  'Hit':         { bg: '#F0FDF4', text: '#166534' },
  'Missed':      { bg: '#FEF2F2', text: '#991b1b' },
}

const TASK_TYPE_PILL: Record<string, { bg: string; text: string }> = {
  Design:         { bg: '#EEF2FF', text: '#3730A3' },
  Engineering:    { bg: '#DBEAFE', text: '#1E40AF' },
  Permitting:     { bg: '#FEF3C7', text: '#92400E' },
  Interconnection:{ bg: '#D1FAE5', text: '#047857' },
  Financial:      { bg: '#FCE7F3', text: '#9D174D' },
  Legal:          { bg: '#E0E7FF', text: '#4338CA' },
  Construction:   { bg: '#FFEDD5', text: '#9A3412' },
  Operations:     { bg: '#F1F5F9', text: '#475569' },
  Administrative: { bg: '#F3F4F6', text: '#374151' },
}

const TASK_STATUS_PILL: Record<string, { bg: string; text: string }> = {
  'Draft':         { bg: '#F1F5F9', text: '#475569' },
  'Pending Info':  { bg: '#FFF7ED', text: '#c2410c' },
  'Ready to Start':{ bg: '#EFF6FF', text: '#1d4ed8' },
  'In Progress':   { bg: '#EFF6FF', text: '#1d4ed8' },
  'Under Review':  { bg: '#FEF3C7', text: '#92400E' },
  'Complete':      { bg: '#F0FDF4', text: '#166534' },
}

// ── Main component ────────────────────────────────────────────────
export function ScheduleTab({ projectId, milestones, scheduleTasks }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const topLevelTasks = useMemo(
    () => scheduleTasks.filter(t => !t.parent_task_id),
    [scheduleTasks]
  )

  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.sort_order - b.sort_order),
    [milestones]
  )

  return (
    <div className="space-y-5">
      <MilestonesSection
        milestones={sortedMilestones}
        onAdd={() => setEditing('new')}
        onEdit={m => setEditing(m)}
      />
      <ScheduleTasksSection tasks={topLevelTasks} />

      {editing !== null && (
        <MilestoneDrawer
          projectId={projectId}
          milestone={editing === 'new' ? null : editing}
          onClose={() => { setEditing(null); setErr(null) }}
          onDone={() => { setEditing(null); router.refresh() }}
          saving={saving}
          setSaving={setSaving}
          err={err}
          setErr={setErr}
        />
      )}
    </div>
  )
}

// ── Milestones table ───────────────────────────────────────────────
function MilestonesSection({
  milestones, onAdd, onEdit,
}: {
  milestones: Milestone[]
  onAdd: () => void
  onEdit: (m: Milestone) => void
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={14} className="text-[#3E3E3C]" />
          <h3 className="text-[14px] font-bold text-[#181818]">Milestones</h3>
          <span className="text-[11px] text-[#94a3b8]">({milestones.length})</span>
        </div>
        <button onClick={onAdd} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add Milestone</button>
      </div>

      {milestones.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No milestones yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Milestone</th>
              <th className="text-left px-4 py-3 label">Target Date</th>
              <th className="text-left px-4 py-3 label">Status</th>
              <th className="text-left px-4 py-3 label">Notes</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map(m => {
              const sp = MILESTONE_PILL[m.status] ?? MILESTONE_PILL['Not Started']
              return (
                <tr key={m.id} onClick={() => onEdit(m)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">{m.label}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{formatDate(m.target_date)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sp.bg, color: sp.text }}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[#3E3E3C] max-w-[300px] truncate">{m.notes || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Schedule tasks ─────────────────────────────────────────────────
function ScheduleTasksSection({ tasks }: { tasks: ScheduleTask[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={14} className="text-[#3E3E3C]" />
          <h3 className="text-[14px] font-bold text-[#181818]">Schedule Tasks</h3>
          <span className="text-[11px] text-[#94a3b8]">({tasks.length})</span>
        </div>
        <span className="text-[11.5px] text-[#706E6B]">Tasks flagged &ldquo;Show on schedule&rdquo;</span>
      </div>

      {tasks.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B] leading-relaxed">
          No tasks on the schedule yet.<br />
          <span className="text-[12.5px]">On the Tasks page, open a task and toggle <strong>Show on schedule</strong> to surface it here.</span>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Task</th>
              <th className="text-left px-4 py-3 label">Type</th>
              <th className="text-left px-4 py-3 label">Status</th>
              <th className="text-left px-4 py-3 label">Start</th>
              <th className="text-left px-4 py-3 label">Due / End</th>
              <th className="text-left px-4 py-3 label">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const tp = TASK_TYPE_PILL[t.type]   ?? TASK_TYPE_PILL['Administrative']
              const sp = TASK_STATUS_PILL[t.status] ?? TASK_STATUS_PILL['Draft']
              const endDate = t.end_date || t.due_date
              return (
                <tr key={t.id} onClick={() => window.location.href = `/tasks?id=${t.id}`} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">
                    {t.title}
                    {(t._subtask_count ?? 0) > 0 && (
                      <span className="ml-2 text-[10.5px] font-semibold text-[#94a3b8]">{t._subtask_count} subtask{t._subtask_count !== 1 ? 's' : ''}</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: tp.bg, color: tp.text }}>{t.type}</span></td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sp.bg, color: sp.text }}>{t.status}</span></td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{formatDate(t.start_date)}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{formatDate(endDate)}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{t.assignee?.full_name ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Milestone drawer ───────────────────────────────────────────────
function MilestoneDrawer({
  projectId, milestone, onClose, onDone, saving, setSaving, err, setErr,
}: {
  projectId: string
  milestone: Milestone | null
  onClose: () => void
  onDone: () => void
  saving: boolean
  setSaving: (v: boolean) => void
  err: string | null
  setErr: (v: string | null) => void
}) {
  const [form, setForm] = useState({
    label: milestone?.label ?? '',
    target_date: milestone?.target_date ? String(milestone.target_date).slice(0, 10) : '',
    status: milestone?.status ?? 'Not Started',
    notes: milestone?.notes ?? '',
  })

  async function save() {
    if (!form.label.trim()) { setErr('Label required'); return }
    setSaving(true); setErr(null)
    const isNew = milestone === null
    const url = isNew ? '/api/milestones' : `/api/milestones/${milestone!.id}`
    const payload: Record<string, unknown> = {
      label: form.label,
      target_date: form.target_date || null,
      status: form.status,
      notes: form.notes || null,
    }
    if (isNew) payload.project_id = projectId
    try {
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) onDone()
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed') }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setSaving(false)
  }

  async function remove() {
    if (!milestone) return
    if (!confirm(`Delete milestone "${milestone.label}"?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/milestones/${milestone.id}`, { method: 'DELETE' })
      if (res.ok) onDone()
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setSaving(false)
  }

  return (
    <RowDrawer
      open={true}
      onClose={onClose}
      title={milestone ? milestone.label : 'Add Milestone'}
      subtitle={milestone ? 'Edit milestone' : 'New project milestone'}
      width={520}
      footer={
        <div className="flex items-center justify-between">
          {milestone ? (
            <button onClick={remove} disabled={saving} className="text-[12px] text-[#dc2626] hover:underline inline-flex items-center gap-1">
              <Trash2 size={12} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      }
    >
      <Section title="Milestone">
        <DrawerInput label="Label" value={form.label} onChange={v => setForm(f => ({ ...f, label: v }))} required placeholder="e.g. PPA Executed" />
        <div className="grid grid-cols-2 gap-3">
          <DrawerInput type="date" label="Target Date" value={form.target_date} onChange={v => setForm(f => ({ ...f, target_date: v }))} />
          <DrawerSelect label="Status" value={form.status} options={MILESTONE_STATUSES} onChange={v => setForm(f => ({ ...f, status: v }))} />
        </div>
      </Section>

      <Section title="Notes">
        <DrawerTextarea label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={4} />
      </Section>

      {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
    </RowDrawer>
  )
}
