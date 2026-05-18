'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { RowDrawer, DrawerField, DrawerInput, DrawerSelect, DrawerTextarea, Section } from './_RowDrawer'

export interface Building {
  id: string
  project_id: string
  name: string
  category: string
  parcel_id: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  county: string | null
  owner_name: string | null
  ahj: string | null
  zoning_type: string | null
  land_use_type: string | null
  year_built: number | null
  total_sqft: number | null
  num_stories: number | null
  roof_type: string | null
  roof_age: number | null
  roof_manufacturer: string | null
  notes: string | null
}
export interface Meter {
  id: string
  building_id: string | null
  meter_num: string
  account_num: string | null
}
export interface SystemRow {
  id: string
  building_id: string | null
  name: string
  size_kwdc: number
  design_status: string
}

const CATEGORIES = ['Building', 'Parking Lot', 'Garage', 'Field', 'Other']
const ROOF_TYPES = ['Membrane (TPO)', 'Membrane (EPDM)', 'Membrane (PVC)', 'Built-Up (BUR)', 'Modified Bitumen', 'Metal', 'Standing Seam Metal', 'Concrete', 'Shingle', 'Tile', 'Ballasted', 'Other']

const CATEGORY_PILL: Record<string, { bg: string; text: string }> = {
  'Building':    { bg: '#eff6ff', text: '#1e40af' },
  'Parking Lot': { bg: '#fef3c7', text: '#92400e' },
  'Garage':      { bg: '#f3e8ff', text: '#6b21a8' },
  'Field':       { bg: '#dcfce7', text: '#166534' },
  'Other':       { bg: '#f1f5f9', text: '#475569' },
}

type FormState = {
  name: string
  category: string
  owner_name: string
  ahj: string
  parcel_id: string
  zoning_type: string
  land_use_type: string
  address: string
  city: string
  state: string
  zip: string
  // conditional
  year_built: string
  total_sqft: string
  num_stories: string
  roof_type: string
  roof_age: string
  roof_manufacturer: string
  notes: string
}

const BLANK: FormState = {
  name: '', category: 'Building',
  owner_name: '', ahj: '', parcel_id: '', zoning_type: '', land_use_type: '',
  address: '', city: '', state: '', zip: '',
  year_built: '', total_sqft: '', num_stories: '',
  roof_type: '', roof_age: '', roof_manufacturer: '',
  notes: '',
}

export function BuildingsTable({
  projectId, buildings, meters, systems,
}: {
  projectId: string
  buildings: Building[]
  meters: Meter[]
  systems: SystemRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState<Building | 'new' | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>(BLANK)

  function startNew() { setForm(BLANK); setErr(null); setOpen('new') }
  function startEdit(b: Building) {
    setForm({
      name: b.name, category: b.category,
      owner_name: b.owner_name ?? '', ahj: b.ahj ?? '',
      parcel_id: b.parcel_id ?? '',
      zoning_type: b.zoning_type ?? '', land_use_type: b.land_use_type ?? '',
      address: b.address ?? '', city: b.city ?? '', state: b.state ?? '', zip: b.zip ?? '',
      year_built: b.year_built?.toString() ?? '',
      total_sqft: b.total_sqft?.toString() ?? '',
      num_stories: b.num_stories?.toString() ?? '',
      roof_type: b.roof_type ?? '',
      roof_age: b.roof_age?.toString() ?? '',
      roof_manufacturer: b.roof_manufacturer ?? '',
      notes: b.notes ?? '',
    })
    setErr(null); setOpen(b)
  }

  async function save() {
    if (!form.name.trim()) { setErr('Area name is required.'); return }
    setSaving(true); setErr(null)
    const isNew = open === 'new'
    const url = isNew ? '/api/buildings' : `/api/buildings/${(open as Building).id}`

    // Strip conditional fields not relevant to selected category
    const showStructural   = form.category === 'Building' || form.category === 'Garage' || form.category === 'Parking Lot'
    const showStories      = form.category === 'Building' || form.category === 'Garage'
    const showRoof         = form.category === 'Building'

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      owner_name: form.owner_name || null,
      ahj: form.ahj || null,
      parcel_id: form.parcel_id || null,
      zoning_type: form.zoning_type || null,
      land_use_type: form.land_use_type || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      year_built:  showStructural && form.year_built  ? Number(form.year_built)  : null,
      total_sqft:  showStructural && form.total_sqft  ? Number(form.total_sqft)  : null,
      num_stories: showStories    && form.num_stories ? Number(form.num_stories) : null,
      roof_type:         showRoof ? (form.roof_type || null) : null,
      roof_age:          showRoof && form.roof_age ? Number(form.roof_age) : null,
      roof_manufacturer: showRoof ? (form.roof_manufacturer || null) : null,
      notes: form.notes || null,
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
    if (!confirm(`Delete "${open.name}"? Linked meters and systems will be unlinked.`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/buildings/${open.id}`, { method: 'DELETE' })
      if (res.ok) { setOpen(null); router.refresh() }
      else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Network error') }
    setSaving(false)
  }

  const selected = typeof open === 'object' ? open : null
  const linkedMeters  = selected ? meters.filter(m => m.building_id === selected.id) : []
  const linkedSystems = selected ? systems.filter(s => s.building_id === selected.id) : []

  const showStructural = form.category === 'Building' || form.category === 'Garage' || form.category === 'Parking Lot'
  const showStories    = form.category === 'Building' || form.category === 'Garage'
  const showRoof       = form.category === 'Building'

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">Areas & Parcels</h3>
        <button onClick={startNew} className="btn-secondary inline-flex items-center gap-1.5"><Plus size={13} /> Add Area</button>
      </div>

      {buildings.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No areas added yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Area Name</th>
              <th className="text-left px-4 py-3 label">Category</th>
              <th className="text-left px-4 py-3 label">Owner</th>
              <th className="text-left px-4 py-3 label">Parcel</th>
              <th className="text-left px-4 py-3 label">City / State</th>
              <th className="text-left px-4 py-3 label">AHJ</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map(b => {
              const c = CATEGORY_PILL[b.category] ?? CATEGORY_PILL['Other']
              const cityState = [b.city, b.state].filter(Boolean).join(', ')
              return (
                <tr key={b.id} onClick={() => startEdit(b)} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc] cursor-pointer">
                  <td className="px-4 py-3 font-medium text-[#181818]">{b.name}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: c.bg, color: c.text }}>{b.category}</span></td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{b.owner_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{b.parcel_id ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{cityState || '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{b.ahj ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <RowDrawer
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open === 'new' ? 'Add Area / Parcel' : selected?.name || ''}
        subtitle={open === 'new' ? 'New site asset' : selected?.category}
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
        {/* Identification */}
        <Section title="Identification">
          <DrawerInput label="Area Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Main Building" required />
          <DrawerSelect label="Category" value={form.category} options={CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} />
        </Section>

        {/* Location — moved up under Area Name/Category */}
        <Section title="Location">
          <DrawerInput label="Street Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
          <div className="grid grid-cols-3 gap-3">
            <DrawerInput label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
            <DrawerInput label="State" value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="FL" />
            <DrawerInput label="Zip" value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} />
          </div>
        </Section>

        {/* Ownership & Regulatory */}
        <Section title="Ownership & Regulatory">
          <DrawerInput label="Owner Name" value={form.owner_name} onChange={v => setForm(f => ({ ...f, owner_name: v }))} placeholder="e.g. AdventHealth Corp." />
          <DrawerInput label="AHJ" value={form.ahj} onChange={v => setForm(f => ({ ...f, ahj: v }))} placeholder="Authority Having Jurisdiction" />
          <DrawerInput label="Parcel" value={form.parcel_id} onChange={v => setForm(f => ({ ...f, parcel_id: v }))} placeholder="Parcel ID / APN" />
          <div className="grid grid-cols-2 gap-3">
            <DrawerInput label="Zoning Type" value={form.zoning_type} onChange={v => setForm(f => ({ ...f, zoning_type: v }))} placeholder="e.g. C-1" />
            <DrawerInput label="Land Use Type" value={form.land_use_type} onChange={v => setForm(f => ({ ...f, land_use_type: v }))} placeholder="e.g. Institutional" />
          </div>
        </Section>

        {/* Conditional structural section */}
        {showStructural && (
          <Section title={`${form.category} Details`}>
            <div className={showStories ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
              <DrawerInput type="number" label="Year Built" value={form.year_built} onChange={v => setForm(f => ({ ...f, year_built: v }))} placeholder="e.g. 1998" />
              <DrawerInput type="number" label="Total Sq Ft" value={form.total_sqft} onChange={v => setForm(f => ({ ...f, total_sqft: v }))} />
              {showStories && (
                <DrawerInput type="number" label="# of Stories" value={form.num_stories} onChange={v => setForm(f => ({ ...f, num_stories: v }))} />
              )}
            </div>
          </Section>
        )}

        {/* Roof — Building only */}
        {showRoof && (
          <Section title="Roof">
            <DrawerSelect label="Roof Type" value={form.roof_type} options={ROOF_TYPES} onChange={v => setForm(f => ({ ...f, roof_type: v }))} />
            <div className="grid grid-cols-2 gap-3">
              <DrawerInput type="number" label="Roof Age (yrs)" value={form.roof_age} onChange={v => setForm(f => ({ ...f, roof_age: v }))} />
              <DrawerInput label="Roof Manufacturer" value={form.roof_manufacturer} onChange={v => setForm(f => ({ ...f, roof_manufacturer: v }))} />
            </div>
          </Section>
        )}

        {/* Notes */}
        <Section title="Notes">
          <DrawerTextarea label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
        </Section>

        {selected && (linkedMeters.length > 0 || linkedSystems.length > 0) && (
          <div className="mt-5 pt-5 border-t border-[#f1f5f9]">
            {linkedMeters.length > 0 && (
              <DrawerField label={`Linked Meters (${linkedMeters.length})`}>
                <ul className="text-[12.5px] text-[#3E3E3C] space-y-1">
                  {linkedMeters.map(m => <li key={m.id}>• {m.meter_num}{m.account_num ? ` · Acct ${m.account_num}` : ''}</li>)}
                </ul>
              </DrawerField>
            )}
            {linkedSystems.length > 0 && (
              <DrawerField label={`Linked Systems (${linkedSystems.length})`}>
                <ul className="text-[12.5px] text-[#3E3E3C] space-y-1">
                  {linkedSystems.map(s => <li key={s.id}>• {s.name} · {s.size_kwdc?.toLocaleString()} kWdc · {s.design_status}</li>)}
                </ul>
              </DrawerField>
            )}
          </div>
        )}

        {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
      </RowDrawer>
    </div>
  )
}

