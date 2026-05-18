'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X, Check } from 'lucide-react'
import { FieldGrid, Field, FieldInput, FieldSelect } from './_editFields'
import { BuildingsTable, type Building } from './BuildingsTable'
import type { Meter } from './MetersTable'
import type { SystemRow } from './SystemsTable'

interface SiteTabProps {
  project: Record<string, unknown>
  buildings?: Building[]
  meters?: Meter[]
  systems?: SystemRow[]
}

const FACILITY_TYPES = ['Acute Care Center', 'Medical Office', 'Distribution Center', 'Hospital', 'Outpatient Center', 'Offsite Medical Center']
const SITE_TYPES = ['Healthcare / Hospital', 'Healthcare / Corporate', 'Industrial', 'Commercial']

export function SiteTab({ project, buildings = [], meters = [], systems = [] }: SiteTabProps) {
  const router = useRouter()
  const p = project as {
    id: string
    project_number?: string
    customer?: string
    address: string; city: string; state: string; zip: string
    facility_type?: string; site_type?: string
    ahj?: string; lat?: number; lng?: number
  }

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    zip: p.zip ?? '',
    facility_type: p.facility_type ?? '',
    site_type: p.site_type ?? '',
    ahj: p.ahj ?? '',
    lat: p.lat ?? '',
    lng: p.lng ?? '',
  })

  function startEdit() {
    setForm({
      address: p.address ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      zip: p.zip ?? '',
      facility_type: p.facility_type ?? '',
      site_type: p.site_type ?? '',
      ahj: p.ahj ?? '',
      lat: p.lat ?? '',
      lng: p.lng ?? '',
    })
    setEditMode(true)
    setError(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lat: form.lat ? Number(form.lat) : null,
          lng: form.lng ? Number(form.lng) : null,
        }),
      })
      if (res.ok) {
        setEditMode(false)
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
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#181818]">Site Information</h3>
          {editMode ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditMode(false); setError(null) }} disabled={saving} className="btn-secondary"><X size={13} /> Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary"><Check size={13} /> {saving ? 'Saving…' : 'Save'}</button>
            </div>
          ) : (
            <button onClick={startEdit} className="btn-secondary"><Pencil size={13} /> Edit</button>
          )}
        </div>
        <div>
          {editMode ? (
            <FieldGrid>
              <Field label="Site Address" full>
                <FieldInput value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="Street address" />
              </Field>
              <Field label="City">
                <FieldInput value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
              </Field>
              <Field label="State">
                <FieldInput value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} />
              </Field>
              <Field label="Zip">
                <FieldInput value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} />
              </Field>
              <Field label="Facility Type">
                <FieldSelect value={form.facility_type} options={FACILITY_TYPES} onChange={v => setForm(f => ({ ...f, facility_type: v }))} />
              </Field>
              <Field label="Site Type">
                <FieldSelect value={form.site_type} options={SITE_TYPES} onChange={v => setForm(f => ({ ...f, site_type: v }))} />
              </Field>
              <Field label="AHJ">
                <FieldInput value={form.ahj} onChange={v => setForm(f => ({ ...f, ahj: v }))} placeholder="Authority Having Jurisdiction" />
              </Field>
              <Field label="Latitude">
                <FieldInput type="number" value={form.lat} onChange={v => setForm(f => ({ ...f, lat: v as unknown as number }))} placeholder="28.5" />
              </Field>
              <Field label="Longitude">
                <FieldInput type="number" value={form.lng} onChange={v => setForm(f => ({ ...f, lng: v as unknown as number }))} placeholder="-81.5" />
              </Field>
            </FieldGrid>
          ) : (
            <FieldGrid>
              <Field label="Project Number">{p.project_number || '—'}</Field>
              <Field label="Customer">{p.customer || '—'}</Field>
              <Field label="Facility Type">{p.facility_type || '—'}</Field>
              <Field label="Site Type">{p.site_type || '—'}</Field>
              <Field label="Site Address" full>{p.address || '—'}</Field>
              <Field label="City">{p.city || '—'}</Field>
              <Field label="State">{p.state || '—'}</Field>
              <Field label="Zip">{p.zip || '—'}</Field>
              <Field label="AHJ">{p.ahj || '—'}</Field>
            </FieldGrid>
          )}

          {error && (
            <div className="mx-6 my-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">
              {error}
            </div>
          )}
        </div>
      </div>

      <BuildingsTable
        projectId={p.id}
        buildings={buildings}
        meters={meters.map(m => ({ id: m.id, building_id: m.building_id, meter_num: m.meter_num, account_num: m.account_num }))}
        systems={systems.map(s => ({ id: s.id, building_id: s.building_id, name: s.name, size_kwdc: s.size_kwdc, design_status: s.design_status }))}
      />
    </div>
  )
}
