'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditToolbar, ErrorBanner, FieldGrid, Field, FieldInput, FieldSelect } from './_editFields'
import { MetersTable, type Meter } from './MetersTable'
import type { Building } from './BuildingsTable'

const RATE_TYPES = ['TOU', 'Non-TOU']
const IX_STATUSES = ['Not Started', 'Submitted', 'In Review', 'Approved', 'Denied']
const IX_VOLTAGES = ['TBD', '120/240V', '208V', '277/480V', '480V', '4.16kV', '12.47kV', '13.2kV', '13.8kV', '23kV', '34.5kV']
const IX_FEASIBILITIES = ['TBD', 'Feasible', 'Likely Feasible', 'Under Review', 'At Risk', 'Infeasible']
const NEM_PROGRAMS = ['TBD', 'Net Metering 2.0', 'Net Billing', 'Standard NEM', 'Aggregate NEM', 'Distributed Generation Rebate', 'No NEM Available']

type Section = 'utility' | 'ix'

export function UtilityTab({ project, buildings = [], meters = [] }: { project: Record<string, unknown>; buildings?: Building[]; meters?: Meter[] }) {
  // Aggregate from meters when any exist
  const hasMeters = meters.length > 0
  const includedMeters = meters.filter(m => m.included)
  const meterUsageKwh  = includedMeters.reduce((s, m) => s + (m.annual_usage_kwh ?? 0), 0)
  const meterPeakKw    = Math.max(0, ...includedMeters.map(m => m.peak_demand_kw ?? 0))
  const router = useRouter()
  const p = project as {
    id: string
    utility?: string; rate_schedule?: string; rate_schedule_type?: string
    annual_usage_kwh?: number; peak_demand_kw?: number
    interconnection_num?: string; interconnection_status?: string
    interconnection_voltage?: string; interconnection_feasibility?: string
    interconnection_cost_estimate?: number
    nem_program?: string; utility_poc?: string
  }

  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [utilityForm, setUtilityForm] = useState({
    utility: p.utility ?? '',
    rate_schedule: p.rate_schedule ?? '',
    rate_schedule_type: p.rate_schedule_type ?? '',
    annual_usage_kwh: p.annual_usage_kwh ?? 0,
    peak_demand_kw: p.peak_demand_kw ?? 0,
    nem_program: p.nem_program ?? '',
    utility_poc: p.utility_poc ?? '',
  })
  const [ixForm, setIxForm] = useState({
    interconnection_num: p.interconnection_num ?? '',
    interconnection_status: p.interconnection_status ?? '',
    interconnection_voltage: p.interconnection_voltage ?? '',
    interconnection_feasibility: p.interconnection_feasibility ?? '',
    interconnection_cost_estimate: p.interconnection_cost_estimate ?? 0,
  })

  function startEdit(section: Section) {
    setError(null)
    if (section === 'utility') setUtilityForm({
      utility: p.utility ?? '',
      rate_schedule: p.rate_schedule ?? '',
      rate_schedule_type: p.rate_schedule_type ?? '',
      annual_usage_kwh: p.annual_usage_kwh ?? 0,
      peak_demand_kw: p.peak_demand_kw ?? 0,
      nem_program: p.nem_program ?? '',
      utility_poc: p.utility_poc ?? '',
    })
    if (section === 'ix') setIxForm({
      interconnection_num: p.interconnection_num ?? '',
      interconnection_status: p.interconnection_status ?? '',
      interconnection_voltage: p.interconnection_voltage ?? '',
      interconnection_feasibility: p.interconnection_feasibility ?? '',
      interconnection_cost_estimate: p.interconnection_cost_estimate ?? 0,
    })
    setEditingSection(section)
  }

  async function save(section: Section) {
    setSaving(true); setError(null)
    const payload: Record<string, unknown> = section === 'utility' ? {
      ...utilityForm,
      annual_usage_kwh: Number(utilityForm.annual_usage_kwh) || 0,
      peak_demand_kw: Number(utilityForm.peak_demand_kw) || 0,
    } : {
      ...ixForm,
      interconnection_cost_estimate: Number(ixForm.interconnection_cost_estimate) || 0,
    }
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setEditingSection(null); router.refresh() }
      else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
    setSaving(false)
  }

  const isEditingUtility = editingSection === 'utility'
  const isEditingIx = editingSection === 'ix'

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#181818]">Utility</h3>
          <EditToolbar editMode={isEditingUtility} saving={saving}
            onEdit={() => startEdit('utility')}
            onCancel={() => { setEditingSection(null); setError(null) }}
            onSave={() => save('utility')} />
        </div>
        <div>
          <FieldGrid>
            <Field label="Utility">
              {isEditingUtility
                ? <FieldInput value={utilityForm.utility} onChange={v => setUtilityForm(f => ({ ...f, utility: v }))} placeholder="e.g., Duke Energy" />
                : (p.utility || '—')}
            </Field>
            <Field label="Rate Schedule">
              {isEditingUtility
                ? <FieldInput value={utilityForm.rate_schedule} onChange={v => setUtilityForm(f => ({ ...f, rate_schedule: v }))} placeholder="e.g., GSDT-1" />
                : (p.rate_schedule || '—')}
            </Field>
            <Field label="Rate Schedule Type">
              {isEditingUtility
                ? <FieldSelect value={utilityForm.rate_schedule_type} options={RATE_TYPES} onChange={v => setUtilityForm(f => ({ ...f, rate_schedule_type: v }))} />
                : (p.rate_schedule_type || '—')}
            </Field>
            <Field label="NEM Program">
              {isEditingUtility
                ? <FieldSelect value={utilityForm.nem_program} options={NEM_PROGRAMS} onChange={v => setUtilityForm(f => ({ ...f, nem_program: v }))} />
                : (p.nem_program || '—')}
            </Field>
            <Field label="Annual Usage">
              {hasMeters
                ? <span>{meterUsageKwh.toLocaleString()} kWh</span>
                : (isEditingUtility
                    ? <FieldInput type="number" value={utilityForm.annual_usage_kwh} onChange={v => setUtilityForm(f => ({ ...f, annual_usage_kwh: v as unknown as number }))} suffix="kWh" />
                    : (p.annual_usage_kwh ? `${p.annual_usage_kwh.toLocaleString()} kWh` : '—'))}
            </Field>
            <Field label="Peak Demand">
              {hasMeters
                ? <span>{meterPeakKw ? `${meterPeakKw} kW` : '—'}</span>
                : (isEditingUtility
                    ? <FieldInput type="number" value={utilityForm.peak_demand_kw} onChange={v => setUtilityForm(f => ({ ...f, peak_demand_kw: v as unknown as number }))} suffix="kW" />
                    : (p.peak_demand_kw ? `${p.peak_demand_kw} kW` : '—'))}
            </Field>
            <Field label="Utility POC" full>
              {isEditingUtility
                ? <FieldInput value={utilityForm.utility_poc} onChange={v => setUtilityForm(f => ({ ...f, utility_poc: v }))} placeholder="Contact name & email" />
                : (p.utility_poc || '—')}
            </Field>
          </FieldGrid>
          {isEditingUtility && <ErrorBanner error={error} />}
        </div>
      </div>


      <MetersTable projectId={p.id} meters={meters} buildings={buildings} />
    </div>
  )
}
