'use client'
import { FieldGrid, Field } from './_editFields'
import { SystemsTable, type SystemRow } from './SystemsTable'
import type { Building } from './BuildingsTable'
import type { Meter } from './MetersTable'
import { SitePlanCard } from './SitePlanCard'
import type { SitePlan } from './_sitePlans'

export function TechnicalTab({ project, buildings = [], meters = [], systems = [], sitePlans = [], users = [] }: {
  project: Record<string, unknown>
  buildings?: Building[]
  meters?: Meter[]
  systems?: SystemRow[]
  sitePlans?: SitePlan[]
  users?: { id: string; full_name: string }[]
}) {
  // Nothing on this card is typed in. The systems table below is the record:
  // migration 077 keeps these three columns equal to the sum over the project's
  // designs where design_status = 'Approved', so the only way to move a number
  // here is to add, edit or approve a design.
  const p = project as {
    id: string
    system_kwdc?: number; system_kwac?: number; annual_production_kwh?: number
  }
  const dc   = p.system_kwdc ?? 0
  const ac   = p.system_kwac ?? 0
  const prod = p.annual_production_kwh ?? 0

  return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[#181818]">System Specs</h3>
          <span className="text-[11.5px] text-[#706E6B]">Totals the approved designs below</span>
        </div>
        <div>
          <FieldGrid>
            <Field label="System Size kWdc">{dc ? dc.toLocaleString() : '—'}</Field>
            <Field label="System Size kWac">{ac ? ac.toLocaleString() : '—'}</Field>
            <Field label="Annual Production kWh">{prod ? prod.toLocaleString() : '—'}</Field>
            <Field label="Yield kWh/kWp">
              {dc > 0 && prod > 0 ? Math.round(prod / dc).toLocaleString() : '—'}
            </Field>
          </FieldGrid>
        </div>
      </div>

      <SitePlanCard sitePlans={sitePlans} systems={systems} />

      <SystemsTable projectId={p.id} systems={systems} buildings={buildings} meters={meters}
        sitePlans={sitePlans} users={users} />
    </div>
  )
}
