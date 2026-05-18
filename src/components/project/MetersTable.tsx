'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { RowDrawer, DrawerInput, DrawerSelect, Section } from './_RowDrawer'
import type { Building } from './BuildingsTable'

export interface Meter {
  id: string
  project_id: string
  building_id: string | null
  meter_num: string
  account_num: string | null
  utility: string | null
  rate_schedule: string | null
  annual_usage_kwh: number | null
  peak_demand_kw: number | null
  blended_rate: number | null
  annual_spend: number | null
  status: string
  included: boolean
  ix_app_num: string | null
  ix_status: string | null
  ix_voltage: string | null
  ix_feasibility: string | null
  ix_cost_estimate: number | null
}

const STATUSES = ['Active', 'Inactive', 'TBD']
const IX_STATUSES = ['Not Started', 'Submitted', 'In Review', 'Approved', 'Denied']
const IX_VOLTAGES = ['TBD', '120/240V', '208V', '277/480V', '480V', '4.16kV', '12.47kV', '13.2kV', '13.8kV', '23kV', '34.5kV']
const IX_FEASIBILITIES = ['TBD', 'Feasible', 'Likely Feasible', 'Under Review', 'At Risk', 'Infeasible']

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  Active:   { bg: '#dcfce7', text: '#166534' },
  Inactive: { bg: '#f1f5f9', text: '#475569' },
  TBD:      { bg: '#fef3c7', text: '#92400e' },
}
const IX_STATUS_PILL: Record<string, { bg: string; text: string }> = {
  'Not Started': { bg: '#f1f5f9', text: '#475569' },
  'Submitted':   { bg: '#eff6ff', text: '#1e40af' },
  'In Review':   { bg: '#fefce8', text: '#854d0e' },
  'Approved':    { bg: '#f0fdf4', text: '#166534' },
  'Denied':      { bg: '#fef2f2', text: '#991b1b' },
}

export function MetersTable({
  projectId, meters, buildings,
}: {
  projectId: string
  meters: Meter[]
  buildings: Building[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState<Meter | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const blank = {
    meter_num: '', account_num: '', building_id: '', utility: '', rate_schedule: '',
    annual_usage_kwh: '', peak_demand_kw: '', blended_rate: '', annual_spend: '',
    status: 'Active', included: true,
    ix_app_num: '', ix_status: '', ix_voltage: '', ix_feasibility: '', ix_cost_estimate: '',
  }
  const [form, setForm] = useState<typeof blank>(blank)

  function startNew() { setForm(blank); setErr(null); setOpen('new') }
  function startEdit(m: Meter) {
    setForm({
      meter_num: m.meter_num, account_num: m.account_num ?? '', building_id: m.building_id ?? '',
      utility: m.utility ?? '', rate_schedule: m.rate_schedule ?? '',
      annual_usage_kwh: m.annual_usage_kwh?.toString() ?? '',
      peak_demand_kw: m.peak_demand_kw?.toString() ?? '',
      blended_rate: m.blended_rate?.toString() ?? '',
      annual_spend: m.annual_spend?.toString() ?? '',
      status: m.status, included: m.included,
      ix_app_num: m.ix_app_num ?? '',
      ix_status: m.ix_status ?? '',
      ix_voltage: m.ix_voltage ?? '',
      ix_feasibility: m.ix_feasibility ?? '',
      ix_cost_estimate: m.ix_cost_estimate?.toString() ?? '',
    })
    setErr(null); setOpen(m)
  }

  async function save() {
    if (!form.meter_num.trim()) { setErr('Meter # is required.'); return }
    setSaving(true); setErr(null)
    const isNew = open === 'new'
    const url = isNew ? '/api/meters' : `/api/meters/${(open as Meter).id}`
    const usage = form.annual_usage_kwh ? Number(form.annual_usage_kwh) : null
    const spend = form.annual_spend ? Number(form.annual_spend) : null
    const blended = usage && spend && usage > 0 ? Number((spend / usage).toFixed(4)) : null
    const payload: Record<string, unknown> = {
      meter_num: form.meter_num,
      account_num: form.account_num || null,
      building_id: form.building_id || null,
      utility: form.utility || null,
      rate_schedule: form.rate_schedule || null,
      annual_usage_kwh: usage,
      peak_demand_kw: form.peak_demand_kw ? Number(form.peak_demand_kw) : null,
      blended_rate: blended,
      annual_spend: spend,
      status: form.status,
      included: form.included,
      ix_app_num: form.ix_app_num || null,
      ix_status: form.ix_status || null,
      ix_voltage: form.ix_voltage || null,
      ix_feasibility: form.ix_feasibility || null,
      ix_cost_estimate: form.ix_cost_estimate ? Number(form.ix_cost_estimate) : null,
    }
    if (isNew) payload.project_id = projectId
    try {
      const res = await fetch(url, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  async function remove() {
    if (typeof open !== 'object' || !open) return
    if (!confirm(`Delete meter ${open.meter_num}?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/meters/${open.id}`, { method: 'DELETE' })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  const selected = typeof open === 'object' ? open : null
  const buildingName = (id: string | null) => buildings.find(b => b.id === id)?.name ?? '—'

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">Meters & Utility Accounts</h3>
        <button onClick={startNew} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add Meter</button>
      </div>

      {meters.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No meters added yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Meter #</th>
              <th className="text-left px-4 py-3 label">Account #</th>
              <th className="text-left px-4 py-3 label">Area</th>
              <th className="text-left px-4 py-3 label">Rate Schedule</th>
              <th className="text-right px-4 py-3 label">Annual Usage</th>
              <th className="text-right px-4 py-3 label">Annual Spend</th>
              <th className="text-center px-4 py-3 label">Incl.</th>
              <th className="text-left px-4 py-3 label">Status</th>
              <th className="text-left px-4 py-3 label">IX Status</th>
            </tr>
          </thead>
          <tbody>
            {meters.map(m => {
              const s = STATUS_PILL[m.status] ?? STATUS_PILL['TBD']
              const ix = m.ix_status ? IX_STATUS_PILL[m.ix_status] : null
              return (
                <tr key={m.id} onClick={() => startEdit(m)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">{m.meter_num}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{m.account_num ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{buildingName(m.building_id)}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{m.rate_schedule ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]">{m.annual_usage_kwh ? `${m.annual_usage_kwh.toLocaleString()} kWh` : '—'}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]">{m.annual_spend ? `$${m.annual_spend.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-center text-[#3E3E3C]">{m.included ? '✓' : '—'}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: s.bg, color: s.text }}>{m.status}</span></td>
                  <td className="px-4 py-3">
                    {ix ? <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: ix.bg, color: ix.text }}>{m.ix_status}</span> : <span className="text-[#94a3b8]">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <RowDrawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === 'new' ? 'Add Meter' : `Meter ${selected?.meter_num}`}
        subtitle={open === 'new' ? 'New utility meter' : (selected?.utility || 'Meter details')}
        footer={
          <div className="flex items-center justify-between">
            {open !== 'new' && selected ? (
              <button onClick={remove} disabled={saving} className="text-[12px] text-[#dc2626] hover:underline inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={() => setOpen(null)} disabled={saving} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        }
      >
        <Section title="Identification">
          <DrawerInput label="Meter #" value={form.meter_num} onChange={v => setForm(f => ({ ...f, meter_num: v }))} placeholder="e.g. 9922908" required />
          <DrawerInput label="Account #" value={form.account_num} onChange={v => setForm(f => ({ ...f, account_num: v }))} />
        </Section>

        <Section title="Linkage">
          <DrawerSelect label="Linked Area" value={buildings.find(b => b.id === form.building_id)?.name ?? ''} options={buildings.map(b => b.name)}
            onChange={v => {
              const b = buildings.find(b => b.name === v)
              setForm(f => ({ ...f, building_id: b?.id ?? '' }))
            }} />
          <DrawerInput label="Utility" value={form.utility} onChange={v => setForm(f => ({ ...f, utility: v }))} placeholder="e.g. Duke Energy" />
          <DrawerInput label="Rate Schedule" value={form.rate_schedule} onChange={v => setForm(f => ({ ...f, rate_schedule: v }))} placeholder="e.g. GSDT-1" />
        </Section>

        <Section title="Usage & Rate">
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput type="number" label="Annual Usage (kWh)" value={form.annual_usage_kwh} onChange={v => setForm(f => ({ ...f, annual_usage_kwh: v }))} />
            <DrawerInput type="number" label="Annual Spend ($)" value={form.annual_spend} onChange={v => setForm(f => ({ ...f, annual_spend: v }))} />
            <DrawerInput type="number" label="Peak Demand (kW)" value={form.peak_demand_kw} onChange={v => setForm(f => ({ ...f, peak_demand_kw: v }))} />
          </div>
          {(() => {
            const usage = Number(form.annual_usage_kwh)
            const spend = Number(form.annual_spend)
            const rate  = usage > 0 && spend > 0 ? spend / usage : null
            return (
              <div className="mb-3 px-3 py-2 bg-[#f8fafc] rounded border border-[#e2e8f0] flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3E3E3C]">Blended Rate ($/kWh)</span>
                <span className="text-[13px] font-semibold text-[#181818]">{rate !== null ? `$${rate.toFixed(4)}` : '—'}</span>
              </div>
            )
          })()}
        </Section>

        <Section title="Status">
          <DrawerSelect label="Status" value={form.status} options={STATUSES} onChange={v => setForm(f => ({ ...f, status: v }))} />
          <label className="flex items-center gap-2 mt-1 mb-3 text-[12.5px] text-[#3E3E3C]">
            <input type="checkbox" checked={form.included} onChange={e => setForm(f => ({ ...f, included: e.target.checked }))} className="rounded" />
            Included in solar offset
          </label>
        </Section>

        <Section title="Interconnection">
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput label="IX Application #" value={form.ix_app_num} onChange={v => setForm(f => ({ ...f, ix_app_num: v }))} />
            <DrawerSelect label="IX Status" value={form.ix_status} options={IX_STATUSES} onChange={v => setForm(f => ({ ...f, ix_status: v }))} />
            <DrawerSelect label="IX Voltage" value={form.ix_voltage} options={IX_VOLTAGES} onChange={v => setForm(f => ({ ...f, ix_voltage: v }))} />
            <DrawerSelect label="Feasibility" value={form.ix_feasibility} options={IX_FEASIBILITIES} onChange={v => setForm(f => ({ ...f, ix_feasibility: v }))} />
          </div>
          <DrawerInput type="number" label="Cost Estimate ($)" value={form.ix_cost_estimate} onChange={v => setForm(f => ({ ...f, ix_cost_estimate: v }))} />
        </Section>

        {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      </RowDrawer>
    </div>
  )
}
