'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check } from 'lucide-react'
import { StageBadge } from '@/components/ui/StageBadge'
import { Avatar } from '@/components/ui/Avatar'
import { formatNumber, formatDate } from '@/lib/utils'
import { FieldGrid, Field, FieldInput, FieldSelect } from './_editFields'

const STAGES = ['Prospecting', 'Proposal', 'Contracting', 'Permitting', 'Construction', 'Operations', 'Archived']
const TRANCHES = ['TR01 - GLR', 'TR02 - WFD', 'TR03 - CFD', 'TR04 - EFD', 'TR05 - CORP']

interface Project {
  id: string
  project_number?: string
  name: string
  stage: string
  system_kwdc: number
  city: string
  state: string
  address: string
  zip: string
  tranche?: string
  region?: string
  target_cod?: string
  assignee_id?: string
  slack_channel_id?: string
}

interface User { id: string; full_name: string }

interface Milestone { label: string; target_date: string | null; completed: boolean }

export function ProjectSummaryCard({
  project,
  assigneeName,
  nextMilestone,
  lastUpdated,
  users,
}: {
  project: Project
  assigneeName: string | null
  nextMilestone: Milestone | undefined
  lastUpdated: string
  users: User[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_number: project.project_number ?? '',
    system_kwdc: project.system_kwdc ?? 0,
    tranche: project.tranche ?? '',
    region: project.region ?? '',
    stage: project.stage ?? 'Prospecting',
    address: project.address ?? '',
    city: project.city ?? '',
    state: project.state ?? '',
    zip: project.zip ?? '',
    target_cod: project.target_cod ? String(project.target_cod).slice(0, 10) : '',
    assignee_id: project.assignee_id ?? '',
  })

  function startEdit() {
    setForm({
      project_number: project.project_number ?? '',
      system_kwdc: project.system_kwdc ?? 0,
      tranche: project.tranche ?? '',
      region: project.region ?? '',
      stage: project.stage ?? 'Prospecting',
      address: project.address ?? '',
      city: project.city ?? '',
      state: project.state ?? '',
      zip: project.zip ?? '',
      target_cod: project.target_cod ? String(project.target_cod).slice(0, 10) : '',
      assignee_id: project.assignee_id ?? '',
    })
    setEditing(true)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_kwdc: Number(form.system_kwdc) || 0,
          tranche: form.tranche || null,
          region: form.region || null,
          stage: form.stage,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          target_cod: form.target_cod || null,
          assignee_id: form.assignee_id || null,
        }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">Project Overview</h3>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setError(null) }} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-[#3E3E3C] bg-white border border-[#DDDBDA] rounded hover:bg-[#F3F2F2]">
                <X size={11} /> Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-white bg-[#70A0D0] rounded hover:bg-[#2C5485] disabled:opacity-50">
                <Check size={11} /> {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <button onClick={startEdit} title="Edit summary"
              className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1 rounded">
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>

      <FieldGrid>
        <Field label="Project ID">
          {editing
            ? <FieldInput value={form.project_number} onChange={v => setForm(f => ({ ...f, project_number: v }))} placeholder="Project number" />
            : (project.project_number || '—')}
        </Field>
        <Field label="System Size kWdc">
          {editing
            ? <FieldInput type="number" value={form.system_kwdc} onChange={v => setForm(f => ({ ...f, system_kwdc: v as unknown as number }))} />
            : formatNumber(project.system_kwdc)}
        </Field>

        <Field label="Tranche">
          {editing
            ? <FieldSelect value={form.tranche} options={TRANCHES} onChange={v => setForm(f => ({ ...f, tranche: v }))} placeholder="— Tranche —" />
            : (project.tranche || '—')}
        </Field>
        <Field label="Region">
          {editing
            ? <FieldInput value={form.region} onChange={v => setForm(f => ({ ...f, region: v }))} placeholder="Region" />
            : (project.region || '—')}
        </Field>

        <Field label="Development Stage" full>
          {editing
            ? <FieldSelect value={form.stage} options={STAGES} onChange={v => setForm(f => ({ ...f, stage: v }))} placeholder="— Stage —" />
            : <StageBadge stage={project.stage} />}
        </Field>

        {/* Address row — 4 fields on one line: Street (flex) · City · State · Zip */}
        <div className="col-span-2 grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] border-b border-[#f1f5f9] min-w-0 w-full">
          <AddressCell label="Site Address" hasRightBorder wideLabel>
            {editing
              ? <FieldInput value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Street" />
              : (project.address || '—')}
          </AddressCell>
          <AddressCell label="City" hasRightBorder>
            {editing
              ? <FieldInput value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
              : (project.city || '—')}
          </AddressCell>
          <AddressCell label="State" hasRightBorder>
            {editing
              ? <FieldInput value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} />
              : (project.state || '—')}
          </AddressCell>
          <AddressCell label="Zip">
            {editing
              ? <FieldInput value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} />
              : (project.zip || '—')}
          </AddressCell>
        </div>

        <Field label="Next Milestone" full>
          <span>{nextMilestone ? nextMilestone.label : '—'}</span>
          {nextMilestone?.target_date && <span className="text-[#706E6B] ml-1.5">· {formatDate(nextMilestone.target_date)}</span>}
        </Field>

        <Field label="Project Manager">
          {editing ? (
            <FieldSelect
              value={form.assignee_id}
              options={users.map(u => u.full_name)}
              onChange={v => {
                const u = users.find(x => x.full_name === v)
                setForm(f => ({ ...f, assignee_id: u?.id ?? '' }))
              }}
              placeholder="Unassigned"
            />
          ) : assigneeName ? (
            <span className="flex items-center gap-1.5">
              <Avatar name={assigneeName} size="sm" />
              {assigneeName}
            </span>
          ) : (
            <span className="text-[#706E6B]">—</span>
          )}
        </Field>
        <Field label="Last Updated">{lastUpdated}</Field>
      </FieldGrid>

      {error && (
        <div className="px-5 py-2 bg-[#fef2f2] border-t border-[#fecaca] text-[12px] text-[#991b1b]">
          {error}
        </div>
      )}
    </div>
  )
}

// Compact mini-field for the horizontal address row.
// Same label-on-left visual pattern as <Field> but narrower so 4 can fit on one line.
function AddressCell({ label, hasRightBorder = false, wideLabel = false, children }: { label: string; hasRightBorder?: boolean; wideLabel?: boolean; children: React.ReactNode }) {
  const cols = wideLabel ? 'grid-cols-[160px_minmax(0,1fr)]' : 'grid-cols-[auto_minmax(0,1fr)]'
  return (
    <div className={`grid ${cols} min-w-0 ${hasRightBorder ? 'border-r border-[#f1f5f9]' : ''}`}>
      <div className={`${wideLabel ? 'px-4' : 'px-3'} py-2 bg-[#fafbfc] border-r border-[#f1f5f9] text-[12px] font-semibold text-[#3E3E3C] flex items-center min-h-[38px] whitespace-nowrap`}>
        {label}
      </div>
      <div className={`${wideLabel ? 'px-4' : 'px-3'} py-2 text-[13px] text-[#181818] flex items-center min-h-[38px] min-w-0 overflow-hidden`}>
        <div className="truncate w-full">{children}</div>
      </div>
    </div>
  )
}
