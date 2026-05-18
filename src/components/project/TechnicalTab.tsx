'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditToolbar, ErrorBanner, FieldGrid, Field, FieldInput } from './_editFields'
import { SystemsTable, type SystemRow } from './SystemsTable'
import type { Building } from './BuildingsTable'
import type { Meter } from './MetersTable'

export function TechnicalTab({ project, buildings = [], meters = [], systems = [] }: {
  project: Record<string, unknown>
  buildings?: Building[]
  meters?: Meter[]
  systems?: SystemRow[]
}) {
  const hasSystems = systems.length > 0
  const sysDcSum   = systems.reduce((s, x) => s + (x.size_kwdc ?? 0), 0)
  const sysAcSum   = systems.reduce((s, x) => s + (x.size_kwac ?? 0), 0)
  const sysProdSum = systems.reduce((s, x) => s + (x.annual_production_kwh ?? 0), 0)
  const router = useRouter()
  const p = project as {
    id: string
    system_kwdc?: number; system_kwac?: number; annual_production_kwh?: number
    _financials?: { yield_kwh_kwp?: number; energy_gen_year1_mwh?: number; system_type?: string }
  }
  const fin = p._financials

  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [specsForm, setSpecsForm] = useState({
    system_kwdc: p.system_kwdc ?? 0,
    system_kwac: p.system_kwac ?? 0,
    annual_production_kwh: p.annual_production_kwh ?? 0,
  })

  function startEdit() {
    setError(null)
    setSpecsForm({
      system_kwdc: p.system_kwdc ?? 0,
      system_kwac: p.system_kwac ?? 0,
      annual_production_kwh: p.annual_production_kwh ?? 0,
    })
    setEditMode(true)
  }

  async function save() {
    setSaving(true); setError(null)
    const payload = {
      system_kwdc: Number(specsForm.system_kwdc) || 0,
      system_kwac: Number(specsForm.system_kwac) || 0,
      annual_production_kwh: Number(specsForm.annual_production_kwh) || 0,
    }
    try {
      const res = await fetch(`/api/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setEditMode(false); router.refresh() }
      else {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
    setSaving(false)
  }

  const effectiveDc = hasSystems ? sysDcSum : (p.system_kwdc ?? 0)
  const sysSizeDcDisplay = effectiveDc.toLocaleString()

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#181818]">System Specs</h3>
          {!hasSystems && (
            <EditToolbar editMode={editMode} saving={saving}
              onEdit={startEdit}
              onCancel={() => { setEditMode(false); setError(null) }}
              onSave={save} />
          )}
        </div>
        <div>
          <FieldGrid>
            <Field label="System Size kWdc">
              {hasSystems
                ? sysSizeDcDisplay
                : (editMode
                    ? <FieldInput type="number" value={specsForm.system_kwdc} onChange={v => setSpecsForm(f => ({ ...f, system_kwdc: v as unknown as number }))} />
                    : sysSizeDcDisplay)}
            </Field>
            <Field label="System Size kWac">
              {hasSystems
                ? (sysAcSum ? sysAcSum.toLocaleString() : '—')
                : (editMode
                    ? <FieldInput type="number" value={specsForm.system_kwac} onChange={v => setSpecsForm(f => ({ ...f, system_kwac: v as unknown as number }))} />
                    : (p.system_kwac ? p.system_kwac.toLocaleString() : '—'))}
            </Field>
            <Field label="Annual Production kWh">
              {hasSystems
                ? (sysProdSum ? sysProdSum.toLocaleString() : '—')
                : (editMode
                    ? <FieldInput type="number" value={specsForm.annual_production_kwh} onChange={v => setSpecsForm(f => ({ ...f, annual_production_kwh: v as unknown as number }))} />
                    : (p.annual_production_kwh ? p.annual_production_kwh.toLocaleString() : '—'))}
            </Field>
            <Field label="Yield kWh/kWp">
              {(() => {
                const dc = hasSystems ? sysDcSum : (p.system_kwdc ?? 0)
                const kwh = hasSystems ? sysProdSum : (p.annual_production_kwh ?? 0)
                return dc > 0 && kwh > 0 ? Math.round(kwh / dc).toLocaleString() : '—'
              })()}
            </Field>
          </FieldGrid>
          {editMode && <ErrorBanner error={error} />}
        </div>
      </div>

      <SystemsTable projectId={p.id} systems={systems} buildings={buildings} meters={meters} />
    </div>
  )
}
