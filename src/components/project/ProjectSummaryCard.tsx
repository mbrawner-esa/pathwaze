'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check, AlertTriangle } from 'lucide-react'
import { StageBadge } from '@/components/ui/StageBadge'
import { SELECTABLE_STAGES } from '@/lib/stages'
import { Avatar } from '@/components/ui/Avatar'
import { formatNumber, formatShortDate } from '@/lib/utils'
import { FieldGrid, Field, FieldInput, FieldSelect } from './_editFields'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'

// Archived is absent on purpose: a project is archived through the actions
// menu, not by picking it from a dropdown.
const STAGES = [...SELECTABLE_STAGES]
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
  lat?: number | null
  lng?: number | null
  tranche?: string
  region?: string  // deprecated — kept for backward compat
  primary_stakeholder_id?: string | null
  target_cod?: string
  assignee_id?: string
  slack_channel_id?: string
}

interface User { id: string; full_name: string; avatar_url?: string | null }
interface Stakeholder { id: string; name: string; title?: string | null; role?: string | null }

/**
 * Whole days from today to an ISO date, in UTC.
 *
 * Parsed as calendar days rather than instants: going through the local
 * timezone shifts a date by one for anyone west of UTC, which would make a
 * milestone read as due today when it is due tomorrow.
 */
function daysUntil(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const target = Date.UTC(y, m - 1, d)
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target - today) / 86400000)
}

// The card only ever renders an *incomplete* milestone (the next one), so it has
// no use for a `completed` flag. Kept minimal so the Workstreams roll-up can
// supply it directly — see nextMilestone() in src/lib/workstreams.ts.
/**
 * The next thing someone actually has to do, not the chapter it sits in.
 * `majorLabel` gives it context ("Term Sheet"), `label` is the milestone itself
 * ("LNTP CFO Approval").
 */
interface Milestone {
  label: string
  target_date: string | null
  majorLabel?: string
  workstreamLabel?: string
}

/** One active workstream, summarised for the card. */
export interface ActiveWorkstream {
  key: string
  label: string
  workstreamLabel: string
  pct: number
  status: 'upcoming' | 'active' | 'at_risk' | 'complete'
}

export function ProjectSummaryCard({
  project,
  assigneeName,
  assigneeAvatarUrl,
  nextMilestone,
  activeWorkstreams = [],
  lastUpdated,
  users,
  stakeholders = [],
}: {
  project: Project
  assigneeName: string | null
  assigneeAvatarUrl?: string | null
  nextMilestone: Milestone | undefined
  activeWorkstreams?: ActiveWorkstream[]
  lastUpdated: string
  users: User[]
  stakeholders?: Stakeholder[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_number: project.project_number ?? '',
    system_kwdc: project.system_kwdc ?? 0,
    tranche: project.tranche ?? '',
    stage: project.stage ?? 'Pre-Planning',
    address: project.address ?? '',
    city: project.city ?? '',
    state: project.state ?? '',
    zip: project.zip ?? '',
    lat: project.lat ?? null as number | null,
    lng: project.lng ?? null as number | null,
    target_cod: project.target_cod ? String(project.target_cod).slice(0, 10) : '',
    assignee_id: project.assignee_id ?? '',
    primary_stakeholder_id: project.primary_stakeholder_id ?? '',
  })

  function startEdit() {
    setForm({
      project_number: project.project_number ?? '',
      system_kwdc: project.system_kwdc ?? 0,
      tranche: project.tranche ?? '',
      stage: project.stage ?? 'Pre-Planning',
      address: project.address ?? '',
      city: project.city ?? '',
      state: project.state ?? '',
      zip: project.zip ?? '',
      lat: project.lat ?? null,
      lng: project.lng ?? null,
      target_cod: project.target_cod ? String(project.target_cod).slice(0, 10) : '',
      assignee_id: project.assignee_id ?? '',
      primary_stakeholder_id: project.primary_stakeholder_id ?? '',
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
          primary_stakeholder_id: form.primary_stakeholder_id || null,
          stage: form.stage,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip,
          lat: form.lat,
          lng: form.lng,
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
        <Field label="Project Contact">
          {editing ? (
            <FieldSelect
              value={stakeholders.find(s => s.id === form.primary_stakeholder_id)?.name ?? ''}
              options={stakeholders.map(s => s.name)}
              onChange={v => {
                const s = stakeholders.find(x => x.name === v)
                setForm(f => ({ ...f, primary_stakeholder_id: s?.id ?? '' }))
              }}
              placeholder={stakeholders.length === 0 ? 'No stakeholders yet — add on the Stakeholders tab' : '— No contact —'}
            />
          ) : (() => {
            const contact = stakeholders.find(s => s.id === project.primary_stakeholder_id)
            // Show just the name, as a link to the Stakeholders tab of this project.
            return contact ? (
              <Link href={`/projects/${project.id}?tab=stakeholders`} className="font-medium text-[#2C5485] hover:underline">
                {contact.name}
              </Link>
            ) : <span className="text-[#706E6B]">—</span>
          })()}
        </Field>

        <Field label="Development Stage" full>
          {editing
            ? <FieldSelect value={form.stage} options={STAGES} onChange={v => setForm(f => ({ ...f, stage: v }))} placeholder="— Stage —" />
            : <StageBadge stage={project.stage} />}
        </Field>

        {/* Address row — 4 fields on one line. Site Address autocompletes; selecting populates City/State/Zip. */}
        <div className="col-span-2 grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.7fr)] border-b border-[#f1f5f9] min-w-0 w-full">
          <AddressCell label="Site Address" hasRightBorder wideLabel>
            {editing
              ? <AddressAutocomplete
                  initial={form.address}
                  onSelect={(a) => setForm(f => ({
                    ...f,
                    address: a.street || f.address,
                    city: a.city || f.city,
                    state: a.state || f.state,
                    zip: a.zip || f.zip,
                    lat: a.lat,
                    lng: a.lng,
                  }))}
                  placeholder="Street"
                />
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

        <Field label="Active Workstreams" full>
          {activeWorkstreams.length === 0 ? (
            <span className="text-[#706E6B]">Nothing in progress</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1.5">
              {activeWorkstreams.map(w => (
                <Link
                  key={w.key}
                  href={`/projects/${project.id}?tab=workstreams`}
                  title={`${w.workstreamLabel}: ${w.label} — ${w.pct}% complete`}
                  className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-0.5 hover:opacity-80"
                  style={{
                    background: w.status === 'at_risk' ? '#FEF3C7' : '#FDF6E6',
                    color: w.status === 'at_risk' ? '#92400E' : '#8A6519',
                    border: `1px solid ${w.status === 'at_risk' ? '#F3D08A' : '#E6C87A'}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="rounded-full shrink-0"
                    style={{
                      width: 6, height: 6,
                      background: w.status === 'at_risk' ? '#F59E0B' : '#C8963A',
                    }}
                  />
                  <span className="text-[12px] font-semibold">{w.label}</span>
                  <span className="text-[11px] opacity-70" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {w.pct}%
                  </span>
                </Link>
              ))}
            </span>
          )}
        </Field>

        {/* Next Milestone: the actual next deliverable, with the major it sits
            under for context, and an alert once its date is close or past. */}
        <Field label="Next Milestone" full>
          {!nextMilestone ? (
            <span className="text-[#706E6B]">Nothing outstanding</span>
          ) : (() => {
            const days = nextMilestone.target_date ? daysUntil(nextMilestone.target_date) : null
            // Overdue and "this week" are the two states worth interrupting for.
            // Anything further out is information, so it stays quiet.
            const tone = days === null ? null
              : days < 0 ? { bg: '#FEF2F2', fg: '#991B1B', dot: '#EF4444', text: `${Math.abs(days)}d overdue` }
              : days <= 7 ? { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B', text: days === 0 ? 'Due today' : `${days}d left` }
              : { bg: '#F0FDF4', fg: '#166534', dot: '#22A45D', text: `${days}d out` }

            return (
              <Link
                href={`/projects/${project.id}?tab=workstreams`}
                className="inline-flex items-center gap-2.5 rounded-md px-2.5 py-1.5 -ml-2.5 hover:bg-[#F7FAFC] transition-colors"
              >
                <span
                  aria-hidden
                  className="rounded-full shrink-0"
                  style={{ width: 8, height: 8, background: tone?.dot ?? '#CBD5DF' }}
                />
                <span className="flex flex-col leading-tight">
                  <span className="text-[13.5px] font-semibold text-[#181818]">
                    {nextMilestone.label}
                  </span>
                  {(nextMilestone.majorLabel || nextMilestone.workstreamLabel) && (
                    <span className="text-[11px] text-[#9AA7B4]">
                      {[nextMilestone.workstreamLabel, nextMilestone.majorLabel].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {nextMilestone.target_date ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-1 rounded-full shrink-0"
                    style={{ background: tone!.bg, color: tone!.fg }}
                  >
                    {days !== null && days <= 7 && <AlertTriangle size={10} />}
                    {formatShortDate(nextMilestone.target_date)} · {tone!.text}
                  </span>
                ) : (
                  <span className="text-[11.5px] px-2 py-1 rounded-full shrink-0"
                        style={{ background: '#F1F5F9', color: '#64748B' }}>
                    No date set
                  </span>
                )}
              </Link>
            )
          })()}
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
              <Avatar name={assigneeName} imageUrl={assigneeAvatarUrl} size="sm" />
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
      <div className={`${wideLabel ? 'px-4' : 'px-3'} py-2 text-[13px] text-[#181818] flex items-center min-h-[38px] min-w-0 w-full`}>
        <div className="w-full min-w-0 truncate">{children}</div>
      </div>
    </div>
  )
}
