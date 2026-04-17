function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-sm text-[#334155]">{value ?? '—'}</p>
    </div>
  )
}

export function TechnicalTab({ project }: { project: Record<string, unknown> }) {
  const p = project as {
    system_kwdc: number; system_kwac: number; annual_production_kwh: number
    modules: string; inverters: string; monitoring: string
    azimuth: string; tilt: string; roof_type: string
  }
  const fin = project._financials as { yield_kwh_kwp: number; energy_gen_year1_mwh: number; system_type: string } | undefined

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">System Specs</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="System Size (DC)" value={p.system_kwdc >= 1000 ? `${(p.system_kwdc / 1000).toFixed(2)} MWdc` : `${p.system_kwdc} kWdc`} />
          <Field label="System Size (AC)" value={p.system_kwac ? `${p.system_kwac} kWac` : '—'} />
          <Field label="Annual Production" value={p.annual_production_kwh ? `${p.annual_production_kwh.toLocaleString()} kWh` : '—'} />
          <Field label="Yield (kWh/kWp)" value={fin?.yield_kwh_kwp} />
          <Field label="Year 1 Generation" value={fin?.energy_gen_year1_mwh ? `${fin.energy_gen_year1_mwh} MWh` : '—'} />
          <Field label="System Type" value={fin?.system_type} />
          <Field label="Roof Type" value={p.roof_type} />
          <Field label="Azimuth" value={p.azimuth} />
          <Field label="Tilt" value={p.tilt} />
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Equipment</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Modules" value={p.modules} />
          <Field label="Inverters" value={p.inverters} />
          <Field label="Monitoring" value={p.monitoring} />
        </div>
      </div>
    </div>
  )
}
