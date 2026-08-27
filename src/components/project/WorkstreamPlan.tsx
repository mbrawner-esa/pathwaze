'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Trash2, GripVertical, AlertTriangle, Check, X, ChevronRight, Pencil, CheckCircle2,
  Link2, Zap, Lock, Users,
} from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { NotesRender } from '@/components/ui/NotesRender'
import { NewMilestoneDialog, type NewMilestoneValues } from './NewMilestoneDialog'
import { formatDate, formatShortDate } from '@/lib/utils'
import { NewTaskModal } from './ProjectActivityActions'
import { Avatar } from '@/components/ui/Avatar'
import {
  tasksByMilestone, buildThread, weightWarning, gateRequirements, objectiveMark,
  varianceLabel, departmentsFor, TASK_COMPLETE,
  type Milestone, type Gate, type MilestoneDep, type MajorRollup, type LinkedTask,
  type WorkstreamActivity, type GateLink, type Department, type DepartmentTag,
} from '@/lib/workstreams'

interface AppUser { id: string; full_name: string; avatar_url?: string | null }
interface Update {
  id: string
  body: string
  created_at: string
  created_by: string | null
  major_key: string | null
}

// No "at risk": the dates say that. See MilestoneStatus in lib/workstreams.
const STATUS_OPTIONS: { value: Milestone['status']; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'complete',    label: 'Complete' },
]

const STATUS_STYLE: Record<Milestone['status'], React.CSSProperties> = {
  not_started: { background: '#F1F5F9', color: '#64748B' },
  in_progress: { background: '#EFF6FF', color: '#1D4ED8' },
  blocked:     { background: '#FEF2F2', color: '#991B1B' },
  complete:    { background: '#F0FDF4', color: '#166534' },
}

/**
 * How a milestone row reads at a glance.
 *
 * A milestone is a planning checkpoint, not a to-do — a tick box with a
 * strike-through made it feel like a task, which is exactly the confusion the
 * hierarchy exists to avoid. So status colours the card instead: a tinted
 * ground and a spine down the left edge, strongest when complete.
 */
const CARD_STYLE: Record<Milestone['status'], { bg: string; spine: string }> = {
  not_started: { bg: 'transparent', spine: 'transparent' },
  in_progress: { bg: '#F7FBFF',     spine: '#3B82F6' },
  blocked:     { bg: '#FFFAFA',     spine: '#EF4444' },
  complete:    { bg: '#F4FDF7',     spine: '#22A45D' },
}

export function WorkstreamPlan({
  projectId, projectName, rollup, milestones, deps, gates, gateLinks, majorLabelOf,
  updates, tasks, activity, users, departments, departmentTags, conflicts, isAdmin,
}: {
  projectId: string
  projectName: string
  rollup: MajorRollup
  milestones: Milestone[]
  deps: MilestoneDep[]
  gates: Gate[]
  gateLinks: GateLink[]
  /** major_key → label, so a linked milestone can name the workstream it lives in */
  majorLabelOf: (majorKey: string) => string
  updates: Update[]
  tasks: LinkedTask[]
  activity: WorkstreamActivity[]
  users: AppUser[]
  departments: Department[]
  departmentTags: DepartmentTag[]
  conflicts: Set<string>
  isAdmin: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [taskFor, setTaskFor] = useState<Milestone | null>(null)
  // Milestone NAMES are fixed — Reports compare them across projects, so a
  // rename anywhere would break the comparison everywhere. Only the description
  // is editable, and only by an admin.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [updateBody, setUpdateBody] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const mine = milestones
    .filter(m => m.major_key === rollup.key)
    .sort((a, b) => a.sort_order - b.sort_order)
  const byId = new Map(milestones.map(m => [m.id, m]))
  const userById = new Map(users.map(u => [u.id, u]))
  const taskMap = tasksByMilestone(tasks)

  const predecessorsOf = (id: string) =>
    deps.filter(d => d.milestone_id === id)
      .map(d => byId.get(d.depends_on))
      .filter((m): m is Milestone => !!m)

  const exitGates = gates.filter(g => g.major_key === rollup.key && g.kind === 'gate')
  const objectives = gates.filter(g => g.major_key === rollup.key && g.kind === 'objective')
  // One chronological thread: written updates, completed tasks and milestone /
  // gate events. The log should reflect what happened, not only what someone
  // remembered to write down.
  const thread = buildThread({ updates, tasks, milestones, activity, majorKey: rollup.key })
  const warning = weightWarning(rollup)

  async function call(url: string, init: RequestInit) {
    setBusy(true); setError(null)
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? 'Something went wrong. Nothing was saved.')
        return false
      }
      router.refresh()
      return true
    } catch {
      setError('Could not reach the server. Nothing was saved.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const tagDepartment = (milestoneId: string, key: string) =>
    call('/api/workstreams/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestone_id: milestoneId, department_key: key }),
    })

  const untagDepartment = (milestoneId: string, key: string) =>
    call(`/api/workstreams/departments?milestone_id=${encodeURIComponent(milestoneId)}&department_key=${encodeURIComponent(key)}`,
      { method: 'DELETE' })

  const patchMilestone = (id: string, patch: Record<string, unknown>) =>
    call(`/api/workstreams/milestones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

  async function createMilestone(v: NewMilestoneValues) {
    const ok = await call('/api/workstreams/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, major_key: rollup.key, ...v }),
    })
    if (ok) setShowNew(false)
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setEditDescription(m.description ?? '')
  }

  async function saveEdit(m: Milestone) {
    if (editDescription === (m.description ?? '')) { setEditingId(null); return }
    const ok = await patchMilestone(m.id, { description: editDescription || null })
    if (ok) setEditingId(null)
  }

  async function removeMilestone(m: Milestone) {
    const linked = taskMap.get(m.id)?.length ?? 0
    const note = linked
      ? `\n\nIts ${linked} linked task${linked > 1 ? 's' : ''} will stay in Tasks, just unlinked.`
      : ''
    if (!window.confirm(`Delete milestone "${m.label}"?${note}`)) return
    await call(`/api/workstreams/milestones/${m.id}`, { method: 'DELETE' })
  }

  const toggleTask = (t: LinkedTask) =>
    call(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: t.status === TASK_COMPLETE ? 'In Progress' : TASK_COMPLETE }),
    })

  async function postUpdate() {
    if (!updateBody.trim()) return
    const ok = await call('/api/workstreams/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        workstream: rollup.workstream,
        major_key: rollup.key,
        body: updateBody,
      }),
    })
    if (ok) setUpdateBody('')
  }

  /** Drag-to-reprioritize. */
  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return }
    const ids = mine.map(m => m.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    setDragId(null)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ...ids.splice(from, 1))
    await call('/api/workstreams/milestones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  }

  return (
    <div className="pt-1 pb-4">
      {error && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded text-[12.5px]"
             style={{ background: '#FEF2F2', color: '#991B1B' }}>
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0, 1.65fr) minmax(240px, .95fr)' }}>
        {/* ── Milestones ── */}
        <div className="rounded border border-[#E4EAF0] bg-white overflow-hidden self-start">
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-[#F1F5F9] border-b border-[#E4EAF0]">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#55677A]">Milestones</h4>
            <span className="text-[11px] text-[#706E6B]">
              {rollup.milestoneCount - rollup.doneCount} of {rollup.milestoneCount} open · drag to reprioritize
            </span>
          </div>

          {warning && (
            <p className="flex items-center gap-1.5 m-0 px-3 py-1.5 text-[12px] border-b border-[#F3E4C0]"
               style={{ background: '#FFFDF6', color: '#92400E' }}>
              <AlertTriangle size={12} className="shrink-0" /> {warning}
            </p>
          )}

          {mine.length === 0 ? (
            <p className="px-3 py-4 m-0 text-[12.5px] text-[#9AA7B4]">
              No milestones yet. Add the first one to give this major milestone a window —
              its dates and progress are derived from its milestones.
            </p>
          ) : (
            <ul className="m-0 p-0 list-none">
              {mine.map((m, i) => {
                const done = m.status === 'complete'
                const preds = predecessorsOf(m.id)
                const conflicted = conflicts.has(m.id)
                const linked = taskMap.get(m.id) ?? []
                const openTasks = linked.filter(t => t.status !== TASK_COMPLETE).length
                const open = expanded.has(m.id)

                return (
                  <li
                    key={m.id}
                    data-entity-id={m.id}
                    className="border-b border-[#EDF1F5] last:border-0 transition-colors"
                    draggable
                    onDragStart={() => setDragId(m.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => dropOn(m.id)}
                    style={{
                      background: dragId === m.id ? '#F1F5F9' : CARD_STYLE[m.status].bg,
                      borderLeft: `3px solid ${CARD_STYLE[m.status].spine}`,
                    }}
                  >
                    <div className="flex items-start gap-2.5 px-3 py-2.5">
                      <span className="flex items-center gap-1 pt-0.5 text-[#A9B5C1] cursor-grab shrink-0"
                            title="Drag to Reprioritize">
                        <GripVertical size={13} />
                        <b className="text-[10px] font-semibold text-[#55677A]">P{i + 1}</b>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {done && (
                            <Check size={13} strokeWidth={3} color="#22A45D" className="shrink-0" aria-hidden />
                          )}
                          <span
                            className="text-[13.5px]"
                            style={{ color: done ? '#166534' : '#181818', fontWeight: done ? 600 : 500 }}
                          >
                            {m.label}
                          </span>

                          {m.is_critical && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE' }}>
                              <Zap size={9} strokeWidth={2.5} /> Critical path
                            </span>
                          )}

                          {(() => {
                            const slip = m.end_date && m.baseline_date
                              ? Math.round((Date.parse(m.end_date) - Date.parse(m.baseline_date)) / 86400000)
                              : null
                            if (!slip) return null
                            const late = slip > 0
                            return (
                              <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                    style={late
                                      ? { background: '#FEF2F2', color: '#991B1B' }
                                      : { background: '#F0FDF4', color: '#166534' }}
                                    title={`Baseline ${formatShortDate(m.baseline_date)} → target ${formatShortDate(m.end_date)}`}>
                                {varianceLabel(-slip)}
                              </span>
                            )
                          })()}

                          {Number(m.weight_pct) > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{ background: '#F1F5F9', color: '#55677A' }}>
                              {Number(m.weight_pct)}%
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpanded(prev => {
                              const next = new Set(prev)
                              if (next.has(m.id)) next.delete(m.id)
                              else next.add(m.id)
                              return next
                            })}
                            className="flex items-center gap-1 text-[11px] text-[#55677A] hover:text-[#181818]"
                          >
                            <ChevronRight size={11} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }} />
                            {linked.length
                              ? `${openTasks} of ${linked.length} task${linked.length > 1 ? 's' : ''} open`
                              : 'Add tasks'}
                          </button>
                        </div>

                        <DepartmentChips
                          milestoneId={m.id}
                          tagged={departmentsFor(m.id, departmentTags, departments)}
                          departments={departments}
                          busy={busy}
                          onTag={tagDepartment}
                          onUntag={untagDepartment}
                        />

                        {m.stage_gate && (
                          <p className="m-0 mt-1 text-[12px] text-[#55677A]">
                            <b className="font-semibold text-[#3E3E3C]">Gate: </b>{m.stage_gate}
                          </p>
                        )}

                        {preds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {preds.map(p => (
                              <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded"
                                    style={{ background: conflicted ? '#FEF2F2' : '#EDF2F7', color: conflicted ? '#991B1B' : '#4A5A6A' }}>
                                ↳ after {p.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {conflicted && (
                          <p className="flex items-start gap-1.5 mt-1.5 m-0 text-[12px]" style={{ color: '#991B1B' }}>
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                            <span>Starts before a predecessor finishes — the dates and the dependency disagree.</span>
                          </p>
                        )}

                        {m.risk && (
                          <div className="mt-1.5 pl-2 text-[12.5px]" style={{ borderLeft: '2px solid #F59E0B', color: '#92400E' }}>
                            <b className="font-semibold">Risk · </b><NotesRender source={m.risk} className="inline" />
                          </div>
                        )}

                        {editingId === m.id ? (
                          <div className="mt-2">
                            <RichTextEditor
                              value={editDescription}
                              onChange={setEditDescription}
                              placeholder="What this milestone covers"
                              minHeight={70}
                            />
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button" onClick={() => saveEdit(m)} disabled={busy}
                                className="text-[12px] font-bold px-2.5 py-1.5 rounded disabled:opacity-50"
                                style={{ background: '#2F3E50', color: '#fff' }}
                              >
                                Save
                              </button>
                              <button
                                type="button" onClick={() => setEditingId(null)}
                                className="text-[12px] font-semibold px-2.5 py-1.5 rounded border border-[#D6DEE7] text-[#55677A]"
                              >
                                Cancel
                              </button>
                              <span className="text-[11px] text-[#9AA7B4]">
                                Milestone names are fixed so projects stay comparable in reporting. Descriptions are admin-editable.
                              </span>
                            </div>
                          </div>
                        ) : m.description ? (
                          <div className="mt-1.5 pl-2 text-[12.5px] text-[#55677A]" style={{ borderLeft: '2px solid #E4EAF0' }}>
                            <NotesRender source={m.description} />
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <select
                            value={m.status}
                            onChange={e => patchMilestone(m.id, { status: e.target.value })}
                            disabled={busy}
                            aria-label="Status"
                            className="text-[11px] font-semibold rounded px-1.5 py-0.5 border-0 cursor-pointer"
                            style={STATUS_STYLE[m.status]}
                          >
                            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>

                          {/* Baseline is set first, deliberately. Variance measures the
                              target against the original commitment, so a target with no
                              baseline behind it measures against nothing. */}
                          <BaselineField milestone={m} isAdmin={isAdmin} onPatch={patchMilestone} />

                          <DateField
                            label="Target"
                            value={m.end_date}
                            disabled={!m.baseline_date}
                            title={m.baseline_date
                              ? 'Current expected completion. Moving it creates variance against the baseline.'
                              : 'Set the baseline first — the target is measured against it.'}
                            onCommit={v => patchMilestone(m.id, { end_date: v })}
                          />

                          <label className="flex items-center gap-1 text-[11px] text-[#55677A] cursor-pointer">
                            <input
                              type="checkbox" checked={m.is_critical} disabled={busy}
                              onChange={e => patchMilestone(m.id, { is_critical: e.target.checked })}
                            />
                            Critical
                          </label>

                          <label className="flex items-center gap-1 text-[11px] text-[#55677A]">
                            <input
                              type="number" min={0} max={100} defaultValue={Number(m.weight_pct)}
                              disabled={busy} aria-label="Share of major milestone"
                              onBlur={e => {
                                const v = Number(e.target.value)
                                if (!Number.isNaN(v) && v !== Number(m.weight_pct)) patchMilestone(m.id, { weight_pct: v })
                              }}
                              className="w-[52px] text-[11px] border border-[#E1E8EF] rounded px-1.5 py-0.5"
                            />
                            %
                          </label>

                          {isAdmin && editingId !== m.id && (
                            <button
                              type="button" onClick={() => startEdit(m)} disabled={busy}
                              aria-label={`Edit description for ${m.label}`}
                              title="Edit Description (Admin)"
                              className="text-[#A9B5C1] hover:text-[#181818] ml-auto"
                            >
                              <Pencil size={12} />
                            </button>
                          )}

                          <button
                            type="button" onClick={() => removeMilestone(m)} disabled={busy}
                            aria-label={`Delete ${m.label}`}
                            className={`text-[#A9B5C1] hover:text-[#991B1B] ${isAdmin && editingId !== m.id ? '' : 'ml-auto'}`}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {open && (
                          <div className="mt-2 ml-1 pl-3" style={{ borderLeft: '2px solid #E4EAF0' }}>
                            <p className="m-0 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9AA7B4]">
                              Tasks
                            </p>

                            {linked.length === 0 && (
                              <p className="m-0 mb-1.5 text-[12px] text-[#9AA7B4]">
                                No tasks yet. Tasks added here are ordinary tasks — they appear in Tasks and on the
                                assignee&apos;s list.
                              </p>
                            )}

                            <ul className="m-0 p-0 list-none">
                              {linked.map(t => {
                                const tDone = t.status === TASK_COMPLETE
                                const who = t.assignee_id ? userById.get(t.assignee_id) : undefined
                                return (
                                  <li key={t.id} className="flex items-start gap-2 py-1.5">
                                    <button
                                      type="button" onClick={() => toggleTask(t)} disabled={busy}
                                      aria-label={tDone ? 'Reopen task' : 'Complete task'}
                                      className="mt-0.5 grid place-items-center rounded shrink-0"
                                      style={{
                                        width: 13, height: 13,
                                        border: tDone ? '1.5px solid #22A45D' : '1.5px solid #C2CDD8',
                                        background: tDone ? '#22A45D' : '#fff',
                                      }}
                                    >
                                      {tDone && <Check size={9} color="#fff" strokeWidth={3} />}
                                    </button>
                                    <Link
                                      href={`/tasks?id=${t.id}`}
                                      className="text-[12.5px] flex-1 hover:underline"
                                      style={{ color: tDone ? '#7B8794' : '#3E3E3C', textDecoration: tDone ? 'line-through' : undefined }}
                                    >
                                      {t.title}
                                    </Link>
                                    {t.due_date && (
                                      <span className="text-[10.5px] text-[#9AA7B4] shrink-0">{formatShortDate(t.due_date)}</span>
                                    )}
                                    {who && <Avatar name={who.full_name} imageUrl={who.avatar_url} size="sm" />}
                                  </li>
                                )
                              })}
                            </ul>

                            <button
                              type="button"
                              onClick={() => setTaskFor(m)}
                              disabled={busy}
                              className="flex items-center gap-1 mt-1 text-[11.5px] font-semibold text-[#2F3E50] hover:text-[#C8963A]"
                            >
                              <Plus size={11} /> Add Task
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="px-3 py-2 border-t border-[#EDF1F5] bg-[#FAFCFD]">
            <button
              type="button" onClick={() => setShowNew(true)} disabled={busy}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#2F3E50] hover:text-[#C8963A]"
            >
              <Plus size={13} /> Add Milestone
            </button>
          </div>
        </div>

        {/* ── Gates / objectives / updates ── */}
        <div className="grid gap-3.5 content-start">
          <GateCard
            title="Exit Gates"
            kind="gate"
            items={exitGates}
            projectId={projectId}
            majorKey={rollup.key}
            busy={busy}
            call={call}
            milestones={milestones}
            gateLinks={gateLinks}
            majorLabelOf={majorLabelOf}
          />
          <GateCard
            title="Key Objectives"
            kind="objective"
            items={objectives}
            projectId={projectId}
            majorKey={rollup.key}
            busy={busy}
            call={call}
          />

          <Card title="Weekly Updates">
            {thread.length === 0 ? (
              <p className="px-3 py-2.5 m-0 text-[12.5px] text-[#9AA7B4]">
                Nothing logged yet. Written updates, completed tasks and milestone changes all
                appear here.
              </p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {thread.map(item => {
                  const who = item.userId ? userById.get(item.userId) : undefined

                  if (item.kind === 'update') {
                    return (
                      <li key={item.id} className="px-3 py-2.5 border-b border-[#EDF1F5] last:border-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {who && <Avatar name={who.full_name} imageUrl={who.avatar_url} size="sm" />}
                          <b className="text-[12.5px] font-semibold">{who?.full_name ?? 'Someone'}</b>
                          <time className="ml-auto text-[10.5px] text-[#9AA7B4]">{formatDate(item.at)}</time>
                        </div>
                        <div className="text-[13px] text-[#4C5A67]"><NotesRender source={item.body} /></div>
                      </li>
                    )
                  }

                  if (item.kind === 'task') {
                    return (
                      <li key={item.id}
                          className="flex items-start gap-2 px-3 py-2 border-b border-[#EDF1F5] last:border-0"
                          style={{ background: '#FBFEFC' }}>
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" color="#22A45D" />
                        <span className="text-[12.5px] text-[#4C5A67] flex-1">
                          Task completed —{' '}
                          <Link href={`/tasks?id=${item.taskId}`} className="font-semibold hover:underline">
                            {item.title}
                          </Link>
                        </span>
                        <time className="text-[10.5px] text-[#9AA7B4] shrink-0">{formatDate(item.at)}</time>
                      </li>
                    )
                  }

                  // milestone / gate / ownership events
                  const tone = item.tone === 'good' ? '#166534' : item.tone === 'warn' ? '#92400E' : '#55677A'
                  return (
                    <li key={item.id}
                        className="flex items-start gap-2 px-3 py-2 border-b border-[#EDF1F5] last:border-0">
                      <span aria-hidden className="mt-[6px] shrink-0 rounded-full"
                            style={{ width: 5, height: 5, background: tone }} />
                      <span className="text-[12.5px] flex-1" style={{ color: tone }}>
                        <b className="font-semibold">{who?.full_name ?? 'Someone'}</b> {item.text}
                      </span>
                      <time className="text-[10.5px] text-[#9AA7B4] shrink-0">{formatDate(item.at)}</time>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="px-3 py-2.5 border-t border-[#EDF1F5] bg-[#FAFCFD]">
              <RichTextEditor
                value={updateBody}
                onChange={setUpdateBody}
                placeholder="Log this week's update — @ to tag someone"
                minHeight={60}
                mentionUsers={users}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="button" onClick={postUpdate} disabled={busy || !updateBody.trim()}
                  className="text-[12px] font-bold px-3 py-1.5 rounded disabled:opacity-50"
                  style={{ background: '#E6C87A', color: '#2F3E50' }}
                >
                  Post Update
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {taskFor && (
        <NewTaskModal
          projectId={projectId}
          projectName={projectName}
          users={users}
          milestoneId={taskFor.id}
          milestoneLabel={taskFor.label}
          onClose={() => setTaskFor(null)}
        />
      )}

      {showNew && (
        <NewMilestoneDialog
          majorLabel={rollup.label}
          weightRemaining={Math.max(0, 100 - rollup.weightTotal)}
          busy={busy}
          onCancel={() => setShowNew(false)}
          onCreate={createMilestone}
        />
      )}
    </div>
  )
}

/**
 * Exit gates and key objectives.
 *
 * The two are deliberately styled apart. An exit gate is a hard checkpoint —
 * something must be true to leave the stage — so it reads as an alert: a
 * coloured stripe, a warning glyph, and red when it fails. Objectives are
 * intent rather than blockers, so they stay quiet and carry an emoji marker
 * instead of a number, which makes a list of them scannable rather than
 * bureaucratic.
 *
 * Gates can also require milestones from OTHER workstreams. That is advisory:
 * passing a gate with an open requirement warns, it does not refuse.
 */
function GateCard({
  title, kind, items, projectId, majorKey, busy, call,
  milestones = [], gateLinks = [], majorLabelOf,
}: {
  title: string
  kind: 'gate' | 'objective'
  items: Gate[]
  projectId: string
  majorKey: string
  busy: boolean
  call: (url: string, init: RequestInit) => Promise<boolean>
  milestones?: Milestone[]
  gateLinks?: GateLink[]
  majorLabelOf?: (majorKey: string) => string
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const patch = (body: Record<string, unknown>) =>
    call('/api/workstreams/gates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  async function add() {
    if (!draft.trim()) return
    const ok = await call('/api/workstreams/gates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, major_key: majorKey, kind, label: draft.trim() }),
    })
    if (ok) { setDraft(''); setAdding(false) }
  }

  async function rename(id: string) {
    if (!editDraft.trim()) { setEditingId(null); return }
    const ok = await patch({ id, label: editDraft.trim() })
    if (ok) setEditingId(null)
  }

  async function remove(g: Gate) {
    if (!window.confirm(`Delete "${g.label}"?`)) return
    await call(`/api/workstreams/gates?id=${encodeURIComponent(g.id)}`, { method: 'DELETE' })
  }

  const link = (gateId: string, milestoneId: string) =>
    call('/api/workstreams/gate-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gate_id: gateId, milestone_id: milestoneId }),
    })

  const unlink = (gateId: string, milestoneId: string) =>
    call(`/api/workstreams/gate-links?gate_id=${encodeURIComponent(gateId)}&milestone_id=${encodeURIComponent(milestoneId)}`,
      { method: 'DELETE' })

  const isGate = kind === 'gate'

  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="px-3 py-2.5 m-0 text-[12.5px] text-[#9AA7B4]">Nothing defined yet.</p>
      ) : (
        <ul className="m-0 p-0 list-none">
          {items.map((g, i) => {
            const { required, open } = isGate
              ? gateRequirements(g.id, gateLinks, milestones)
              : { required: [] as Milestone[], open: [] as Milestone[] }
            const passedEarly = isGate && g.status === 'pass' && open.length > 0

            return (
              <li
                key={g.id}
                className="group px-3 py-2.5 border-b border-[#EDF1F5] last:border-0"
                style={isGate ? {
                  borderLeft: `3px solid ${g.status === 'pass' ? '#22A45D' : g.status === 'fail' ? '#EF4444' : '#F59E0B'}`,
                  background: g.status === 'fail' ? '#FFFBFB' : undefined,
                } : undefined}
              >
                <div className="grid gap-2 items-start" style={{ gridTemplateColumns: '17px 1fr auto' }}>
                  {isGate ? (
                    <button
                      type="button"
                      onClick={() => patch({ id: g.id, status: g.status === 'pass' ? 'fail' : g.status === 'fail' ? 'open' : 'pass' })}
                      disabled={busy}
                      title="Cycle: Open → Passed → Failed"
                      aria-label={`Exit gate ${g.label} is ${g.status}`}
                      className="grid place-items-center rounded mt-0.5"
                      style={{
                        width: 17, height: 17,
                        background: g.status === 'pass' ? '#F0FDF4' : g.status === 'fail' ? '#FEF2F2' : '#FFFBEB',
                        color: g.status === 'pass' ? '#166534' : g.status === 'fail' ? '#991B1B' : '#92400E',
                      }}
                    >
                      {g.status === 'pass'
                        ? <Check size={11} strokeWidth={3} />
                        : <AlertTriangle size={11} strokeWidth={2.5} />}
                    </button>
                  ) : (
                    <span className="grid place-items-center mt-0.5 text-[13px]" style={{ width: 17, height: 17 }}>
                      {objectiveMark(i)}
                    </span>
                  )}

                  {editingId === g.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={e => setEditDraft(e.target.value)}
                      onBlur={() => rename(g.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); rename(g.id) }
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="text-[13px] px-1.5 py-1 border border-[#D6DEE7] rounded w-full"
                    />
                  ) : (
                    <span
                      className="text-[13px] leading-snug"
                      style={isGate && g.status === 'fail' ? { color: '#991B1B', fontWeight: 600 } : undefined}
                    >
                      {g.label}
                    </span>
                  )}

                  <span className="flex items-center gap-1">
                    {isGate && (
                      <button
                        type="button"
                        onClick={() => setLinkingId(linkingId === g.id ? null : g.id)}
                        disabled={busy}
                        aria-label={`Link milestones to ${g.label}`}
                        title="Require a Milestone From Any Workstream"
                        className="text-[#A9B5C1] hover:text-[#5B21B6]"
                      >
                        <Link2 size={11} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setEditingId(g.id); setEditDraft(g.label) }}
                      disabled={busy}
                      aria-label={`Edit ${g.label}`}
                      className="text-[#A9B5C1] hover:text-[#181818]"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button" onClick={() => remove(g)} disabled={busy}
                      aria-label={`Delete ${g.label}`}
                      className="text-[#A9B5C1] hover:text-[#991B1B]"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                </div>

                {/* linked requirements, named with the workstream they come from */}
                {required.length > 0 && (
                  <ul className="m-0 mt-1.5 ml-[25px] p-0 list-none grid gap-1">
                    {required.map(m => (
                      <li key={m.id} className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className="rounded-full shrink-0"
                          style={{
                            width: 5, height: 5,
                            background: m.status === 'complete' ? '#22A45D' : '#F59E0B',
                          }}
                        />
                        <span style={{ color: m.status === 'complete' ? '#7B8794' : '#55677A' }}>
                          {majorLabelOf ? `${majorLabelOf(m.major_key)} · ` : ''}{m.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => unlink(g.id, m.id)}
                          disabled={busy}
                          aria-label={`Unlink ${m.label}`}
                          className="text-[#C6D0DA] hover:text-[#991B1B] ml-auto"
                        >
                          <X size={10} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {passedEarly && (
                  <p className="flex items-start gap-1.5 m-0 mt-1.5 ml-[25px] text-[11.5px]" style={{ color: '#991B1B' }}>
                    <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                    Passed with {open.length} requirement{open.length > 1 ? 's' : ''} still open.
                  </p>
                )}

                {linkingId === g.id && (
                  <div className="mt-2 ml-[25px]">
                    <select
                      autoFocus
                      defaultValue=""
                      disabled={busy}
                      aria-label="Add a required milestone"
                      onChange={async e => {
                        if (!e.target.value) return
                        const ok = await link(g.id, e.target.value)
                        if (ok) setLinkingId(null)
                      }}
                      className="w-full text-[12px] px-1.5 py-1 border border-[#D6DEE7] rounded"
                    >
                      <option value="">Require a Milestone…</option>
                      {milestones
                        .filter(m => !required.some(r => r.id === m.id))
                        .map(m => (
                          <option key={m.id} value={m.id}>
                            {majorLabelOf ? `${majorLabelOf(m.major_key)} · ` : ''}{m.label}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="px-3 py-2 border-t border-[#EDF1F5] bg-[#FAFCFD]">
        {adding ? (
          <AddRow
            value={draft}
            onChange={setDraft}
            onSave={add}
            onCancel={() => { setAdding(false); setDraft('') }}
            busy={busy}
            placeholder={isGate ? 'New Exit Gate' : 'New Objective'}
          />
        ) : (
          <button
            type="button" onClick={() => setAdding(true)} disabled={busy}
            className="flex items-center gap-1 text-[11.5px] font-semibold text-[#2F3E50] hover:text-[#C8963A]"
          >
            <Plus size={11} /> Add {isGate ? 'Exit Gate' : 'Objective'}
          </button>
        )}
      </div>
    </Card>
  )
}

/**
 * Target date's counterpart: where this milestone was originally due.
 *
 * Auto-captured from the first target set, then locked — the gap between
 * baseline and target is the slip signal, so letting anyone quietly re-baseline
 * would erase the very thing it exists to show. Admins can still correct it.
 */
function BaselineField({
  milestone, isAdmin, onPatch,
}: {
  milestone: Milestone
  isAdmin: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<boolean>
}) {
  const locked = !!milestone.baseline_date && !isAdmin

  // Unset: an actionable field rather than a dash. This is the first date a PM
  // is meant to enter, so it should look like the next thing to do.
  if (!milestone.baseline_date) {
    // Just the glyph inline; the explanation is on hover rather than occupying a
    // line on every undated milestone, which would be most of the plan at first.
    const why = 'Set a baseline date first. It records what was originally committed and then '
      + 'locks, and every variance figure is measured against it. The target stays disabled until it exists.'
    return (
      <span className="flex items-center gap-1" title={why}>
        <AlertTriangle size={12} className="shrink-0" color="#C8963A" aria-label="Baseline required" />
        <DateField
          label="Baseline"
          value={null}
          tone="prompt"
          title={why}
          ariaLabel="Baseline date"
          onCommit={v => onPatch(milestone.id, { baseline_date: v })}
        />
      </span>
    )
  }

  return (
    <label
      className="flex items-center gap-1 text-[11px] text-[#55677A]"
      title={locked
        ? 'Baseline is locked. Only an admin can change it.'
        : 'Original scheduled date — changing it re-sets the slip measurement'}
    >
      {locked && <Lock size={9} className="text-[#A9B5C1]" />}
      Baseline
      <DateField
        value={milestone.baseline_date}
        disabled={locked}
        ariaLabel="Baseline date"
        onCommit={v => onPatch(milestone.id, { baseline_date: v })}
      />
    </label>
  )
}

/**
 * A date input that does not fight the native picker.
 *
 * Binding a controlled value straight to `onChange` breaks badly here: the
 * picker emits a value for every partial edit (typing a year fires on each
 * digit), and each one used to trigger a save, disable the field and close the
 * calendar before a date could be chosen. So the value is held locally while the
 * field is being edited and committed once on blur or Enter, and the input is
 * never disabled mid-flight.
 */
function DateField({
  label, value, onCommit, disabled, ariaLabel, title, tone,
}: {
  label?: string
  value: string | null
  onCommit: (value: string | null) => void
  disabled?: boolean
  ariaLabel?: string
  title?: string
  /** 'prompt' draws attention to a field that is the next thing to fill in */
  tone?: 'prompt'
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value ?? ''

  const commit = () => {
    if (draft === null) return
    const next = draft || null
    setDraft(null)
    if (next !== (value ?? null)) onCommit(next)
  }

  return (
    <label
      className="flex items-center gap-1 text-[11px]"
      title={title}
      style={{ color: tone === 'prompt' ? '#92400E' : '#55677A' }}
    >
      {label}
      <input
        type="date"
        value={shown}
        disabled={disabled}
        aria-label={ariaLabel ?? label ?? 'Date'}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
          if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
        }}
        className="text-[11px] border rounded px-1.5 py-0.5"
        style={{
          color: disabled ? '#9AA7B4' : '#55677A',
          borderColor: tone === 'prompt' ? '#E6C87A' : '#E1E8EF',
          background: disabled ? '#F7FAFC' : tone === 'prompt' ? '#FFFDF6' : '#fff',
          cursor: disabled ? 'not-allowed' : undefined,
        }}
      />
    </label>
  )
}

/**
 * Which internal teams a milestone pulls in.
 *
 * Teams rather than people on purpose: the point is that Asset Management can
 * see engagement coming a month out without anyone having to guess which
 * individual will pick it up that far ahead.
 */
function DepartmentChips({
  milestoneId, tagged, departments, busy, onTag, onUntag,
}: {
  milestoneId: string
  tagged: Department[]
  departments: Department[]
  busy: boolean
  onTag: (milestoneId: string, key: string) => Promise<boolean>
  onUntag: (milestoneId: string, key: string) => Promise<boolean>
}) {
  const [adding, setAdding] = useState(false)
  const untagged = departments.filter(d => !tagged.some(t => t.key === d.key))

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
      {tagged.map(d => (
        <span
          key={d.key}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: '#EEF2F6', color: '#3E5060' }}
        >
          <Users size={9} className="shrink-0 opacity-70" />
          {d.name}
          <button
            type="button"
            onClick={() => onUntag(milestoneId, d.key)}
            disabled={busy}
            aria-label={`Remove ${d.name}`}
            className="text-[#9AA7B4] hover:text-[#991B1B]"
          >
            <X size={9} />
          </button>
        </span>
      ))}

      {adding && untagged.length > 0 ? (
        <select
          autoFocus
          defaultValue=""
          disabled={busy}
          aria-label="Add a department"
          onBlur={() => setAdding(false)}
          onChange={async e => {
            if (!e.target.value) return
            const ok = await onTag(milestoneId, e.target.value)
            if (ok) setAdding(false)
          }}
          className="text-[10.5px] px-1.5 py-0.5 border border-[#D6DEE7] rounded"
        >
          <option value="">Department…</option>
          {untagged.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
        </select>
      ) : untagged.length > 0 && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          disabled={busy}
          title="Tag a team that gets pulled into this milestone"
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-1.5 py-0.5 rounded border border-dashed border-[#C6D0DA] text-[#7B8794] hover:text-[#2F3E50] hover:border-[#9AA7B4]"
        >
          <Users size={9} /> {tagged.length ? 'Team' : 'Add Team'}
        </button>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-[#E4EAF0] bg-white overflow-hidden">
      <h4 className="m-0 px-3 py-2 bg-[#F1F5F9] border-b border-[#E4EAF0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#55677A]">
        {title}
      </h4>
      {children}
    </div>
  )
}

function AddRow({
  value, onChange, onSave, onCancel, busy, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  busy: boolean
  placeholder: string
}) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onSave() }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="flex-1 text-[12.5px] px-2 py-1.5 border border-[#E1E8EF] rounded"
      />
      <button
        type="button" onClick={onSave} disabled={busy || !value.trim()}
        className="text-[12px] font-bold px-2.5 py-1.5 rounded disabled:opacity-50"
        style={{ background: '#2F3E50', color: '#fff' }}
      >
        Add
      </button>
      <button type="button" onClick={onCancel} className="text-[#A9B5C1] hover:text-[#181818]" aria-label="Cancel">
        <X size={14} />
      </button>
    </div>
  )
}
