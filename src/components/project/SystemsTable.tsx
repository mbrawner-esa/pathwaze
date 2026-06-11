'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { RowDrawer, DrawerInput, DrawerSelect, DrawerMultiSelect, Section } from './_RowDrawer'
import type { Building } from './BuildingsTable'
import type { Meter } from './MetersTable'

export interface SystemRow {
  id: string
  project_id: string
  building_id: string | null
  building_ids: string[]
  meter_id: string | null
  name: string
  design_version: string
  design_status: string
  system_type: string | null
  size_kwdc: number
  size_kwac: number
  yield_kwh_kwp: number | null
  annual_production_kwh: number
  num_modules: number | null
  num_inverters: number | null
  module_wattage: number | null
  inverter_rating: number | null
  design_url: string | null
  // legacy fields kept in DB but not surfaced in UI
  performance_ratio?: number
  modules?: string | null
  inverters?: string | null
  monitoring?: string | null
  racking?: string | null
  azimuth?: string | null
  tilt?: string | null
}

const STATUSES = ['Not Started', 'In Progress', 'Under Review', 'Approved']
const SYSTEM_TYPES = [
  'Ballasted Rooftop',
  'Flush Mount Rooftop',
  'Surface Carport',
  'Garage Carport',
  'Floating',
  'Fixed Tilt Ground Mount',
  'Single Axis Tracker',
]
const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  'Not Started':  { bg: '#f1f5f9', text: '#475569' },
  'In Progress':  { bg: '#eff6ff', text: '#1d4ed8' },
  'Under Review': { bg: '#fef3c7', text: '#92400e' },
  'Approved':     { bg: '#dcfce7', text: '#166534' },
}

export function SystemsTable({
  projectId, systems, buildings, meters,
}: {
  projectId: string
  systems: SystemRow[]
  buildings: Building[]
  meters: Meter[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState<SystemRow | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const blank = {
    name: '', design_version: 'v1.0', design_status: 'Not Started', system_type: '',
    size_kwdc: '', size_kwac: '', yield_kwh_kwp: '',
    building_ids: [] as string[], meter_id: '',
    num_modules: '', module_wattage: '', num_inverters: '', inverter_rating: '',
    design_url: '',
  }
  const [form, setForm] = useState<typeof blank>(blank)

  function startNew() { setForm(blank); setErr(null); setOpen('new') }
  function startEdit(s: SystemRow) {
    setForm({
      name: s.name, design_version: s.design_version, design_status: s.design_status,
      system_type: s.system_type ?? '',
      size_kwdc: s.size_kwdc?.toString() ?? '',
      size_kwac: s.size_kwac?.toString() ?? '',
      yield_kwh_kwp: s.yield_kwh_kwp?.toString() ?? '',
      building_ids: s.building_ids ?? [], meter_id: s.meter_id ?? '',
      num_modules: s.num_modules?.toString() ?? '',
      module_wattage: s.module_wattage?.toString() ?? '',
      num_inverters: s.num_inverters?.toString() ?? '',
      inverter_rating: s.inverter_rating?.toString() ?? '',
      design_url: s.design_url ?? '',
    })
    setErr(null); setOpen(s)
  }

  async function save() {
    if (!form.name.trim()) { setErr('System name is required.'); return }
    setSaving(true); setErr(null)
    const isNew = open === 'new'
    const url = isNew ? '/api/systems' : `/api/systems/${(open as SystemRow).id}`
    const dc  = Number(form.size_kwdc) || 0
    const yld = Number(form.yield_kwh_kwp) || 0
    const payload: Record<string, unknown> = {
      name: form.name,
      design_version: form.design_version || 'v1.0',
      design_status: form.design_status,
      system_type: form.system_type || null,
      size_kwdc: dc,
      size_kwac: Number(form.size_kwac) || 0,
      yield_kwh_kwp: yld || null,
      annual_production_kwh: Math.round(dc * yld),
      building_ids: form.building_ids,
      building_id: form.building_ids[0] || null,
      meter_id: form.meter_id || null,
      num_modules: form.num_modules ? Number(form.num_modules) : null,
      module_wattage: form.module_wattage ? Number(form.module_wattage) : null,
      num_inverters: form.num_inverters ? Number(form.num_inverters) : null,
      inverter_rating: form.inverter_rating ? Number(form.inverter_rating) : null,
      design_url: form.design_url || null,
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
    if (!confirm(`Delete system "${open.name}"?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/systems/${open.id}`, { method: 'DELETE' })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  const selected = typeof open === 'object' ? open : null
  const areaNames = (ids: string[]) => {
    const names = ids.map(id => buildings.find(b => b.id === id)?.name).filter(Boolean)
    return names.length ? names.join(', ') : '—'
  }
  const meterName = (id: string | null) => meters.find(m => m.id === id)?.meter_num ?? '—'

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">Systems</h3>
        <button onClick={startNew} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add System</button>
      </div>

      {systems.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No systems added yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">System Name</th>
              <th className="text-left px-4 py-3 label">Version</th>
              <th className="text-left px-4 py-3 label">Design Status</th>
              <th className="text-left px-4 py-3 label">System Type</th>
              <th className="text-right px-4 py-3 label">Size kWdc</th>
              <th className="text-right px-4 py-3 label">Size kWac</th>
              <th className="text-left px-4 py-3 label">Area</th>
              <th className="text-left px-4 py-3 label">Meter</th>
              <th className="text-right px-4 py-3 label">Annual Prod.</th>
              <th className="text-right px-4 py-3 label">Yield</th>
              <th className="text-left px-4 py-3 label">Design</th>
            </tr>
          </thead>
          <tbody>
            {systems.map(s => {
              const sp = STATUS_PILL[s.design_status] ?? STATUS_PILL['Not Started']
              const yld = s.yield_kwh_kwp ?? (s.size_kwdc > 0 ? Math.round(s.annual_production_kwh / s.size_kwdc) : null)
              return (
                <tr key={s.id} onClick={() => startEdit(s)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">{s.name}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{s.design_version}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sp.bg, color: sp.text }}>{s.design_status}</span></td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{s.system_type ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]">{s.size_kwdc?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]">{s.size_kwac?.toLocaleString() ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{areaNames(s.building_ids ?? [])}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{meterName(s.meter_id)}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]">{s.annual_production_kwh ? `${s.annual_production_kwh.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-right text-[#3E3E3C]" title="kWh/kWp">{yld ? `${yld.toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]" onClick={e => e.stopPropagation()}>
                    {s.design_url
                      ? <a href={s.design_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#2C5485] hover:underline">Open ↗</a>
                      : <span className="text-[#94a3b8]">—</span>}
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
        title={open === 'new' ? 'Add System' : selected?.name || ''}
        subtitle={open === 'new' ? 'New design' : `${selected?.design_version} · ${selected?.design_status}`}
        width={600}
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
          <DrawerInput label="System Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Building A Rooftop" required />
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput label="Version" value={form.design_version} onChange={v => setForm(f => ({ ...f, design_version: v }))} placeholder="v1.0" />
            <DrawerSelect label="Design Status" value={form.design_status} options={STATUSES} onChange={v => setForm(f => ({ ...f, design_status: v }))} />
          </div>
          <DrawerSelect label="System Type" value={form.system_type} options={SYSTEM_TYPES} onChange={v => setForm(f => ({ ...f, system_type: v }))} />
        </Section>

        <Section title="Linkage">
          <DrawerMultiSelect
            label="Linked Areas"
            options={buildings.map(b => ({ value: b.id, label: b.name }))}
            selected={form.building_ids}
            onChange={ids => setForm(f => ({ ...f, building_ids: ids }))}
            emptyText="No areas added yet — add them in the Site tab."
          />
          <DrawerSelect label="Linked Meter" value={meters.find(m => m.id === form.meter_id)?.meter_num ?? ''} options={meters.map(m => m.meter_num)}
            onChange={v => {
              const m = meters.find(m => m.meter_num === v)
              setForm(f => ({ ...f, meter_id: m?.id ?? '' }))
            }} />
        </Section>

        <Section title="Sizing & Production">
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput type="number" label="Size kWdc" value={form.size_kwdc} onChange={v => setForm(f => ({ ...f, size_kwdc: v }))} />
            <DrawerInput type="number" label="Size kWac" value={form.size_kwac} onChange={v => setForm(f => ({ ...f, size_kwac: v }))} />
          </div>
          <DrawerInput type="number" label="Yield (kWh/kWp)" value={form.yield_kwh_kwp} onChange={v => setForm(f => ({ ...f, yield_kwh_kwp: v }))} placeholder="e.g. 1450" />
          {(() => {
            const dc  = Number(form.size_kwdc)
            const yld = Number(form.yield_kwh_kwp)
            const kwh = dc > 0 && yld > 0 ? Math.round(dc * yld) : null
            return (
              <div className="mb-3 px-3 py-2 bg-[#f8fafc] rounded border border-[#e2e8f0] flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3E3E3C]">Annual Production (kWh)</span>
                <span className="text-[13px] font-semibold text-[#181818]">{kwh ? kwh.toLocaleString() : '—'}</span>
              </div>
            )
          })()}
        </Section>

        <Section title="Design Resources">
          <DrawerInput label="Design Link" value={form.design_url} onChange={v => setForm(f => ({ ...f, design_url: v }))} placeholder="https://helioscope.com/… or PVSyst report URL" />
          {form.design_url && (
            <a href={form.design_url} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-[#2C5485] hover:underline mb-3 inline-block">
              Open design ↗
            </a>
          )}
        </Section>

        {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      </RowDrawer>
    </div>
  )
}
