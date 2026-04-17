function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-sm text-[#334155]">{value ?? '—'}</p>
    </div>
  )
}

export function UtilityTab({ project }: { project: Record<string, unknown> }) {
  const p = project as {
    utility: string; rate_schedule: string; rate_schedule_type: string
    annual_usage_kwh: number; peak_demand_kw: number
    interconnection_num: string; interconnection_status: string
    interconnection_voltage: string; interconnection_feasibility: string
    interconnection_cost_estimate: number; nem_program: string; utility_poc: string
  }
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Utility</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Utility" value={p.utility} />
          <Field label="Rate Schedule" value={p.rate_schedule} />
          <Field label="Rate Schedule Type" value={p.rate_schedule_type} />
          <Field label="Annual Usage" value={p.annual_usage_kwh ? `${p.annual_usage_kwh.toLocaleString()} kWh` : '—'} />
          <Field label="Peak Demand" value={p.peak_demand_kw ? `${p.peak_demand_kw} kW` : '—'} />
          <Field label="NEM Program" value={p.nem_program} />
          <Field label="Utility POC" value={p.utility_poc} />
        </div>
      </div>
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Interconnection</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="IX Number" value={p.interconnection_num} />
          <Field label="IX Status" value={p.interconnection_status} />
          <Field label="Voltage" value={p.interconnection_voltage} />
          <Field label="Feasibility" value={p.interconnection_feasibility} />
          <Field label="Cost Estimate" value={p.interconnection_cost_estimate ? `$${p.interconnection_cost_estimate.toLocaleString()}` : '—'} />
        </div>
      </div>
    </div>
  )
}
