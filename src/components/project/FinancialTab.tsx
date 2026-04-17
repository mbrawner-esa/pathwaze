'use client'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { Edit, X, Check } from 'lucide-react'

interface Financials {
  id: string
  project_id: string
  total_cost: number
  itc_eligible_costs: number
  itc_ineligible_costs: number
  estimated_epc_cost: number
  estimated_dev_costs: number
  estimated_ix_costs: number
  development_fee: number
  itc_rate: number
  domestic_content_assumed: boolean
  safe_harbor_required: boolean
  other_incentives_total: number
  incentive_type: string
  contract_type: string
  revenue_type: string
  offtaker_credit: string
  term_months: number
  year1_contract_price: number
  escalation_rate: number
  srec_treatment: string
  avoided_cost_kwh: number
  yield_kwh_kwp: number
  energy_gen_year1_mwh: number
  system_type: string
  annual_savings: number
  payback_years: number
}

function ViewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f8fafc]">
      <span className="text-xs text-[#6E879E] uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-sm font-medium text-[#334155]">{value}</span>
    </div>
  )
}

function EditRow({ label, name, value, prefix, suffix, onChange }: {
  label: string; name: string; value: number | string | boolean; prefix?: string; suffix?: string
  onChange: (name: string, val: string) => void
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#f8fafc]">
      <span className="text-xs text-[#6E879E] uppercase tracking-wide font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-[#94a3b8]">{prefix}</span>}
        <input
          type={typeof value === 'boolean' ? 'checkbox' : 'number'}
          defaultValue={typeof value === 'boolean' ? undefined : String(value)}
          defaultChecked={typeof value === 'boolean' ? value : undefined}
          onChange={e => onChange(name, typeof value === 'boolean' ? String(e.target.checked) : e.target.value)}
          className="border border-[#e2e8f0] rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-[#2F3E50]"
        />
        {suffix && <span className="text-sm text-[#94a3b8]">{suffix}</span>}
      </div>
    </div>
  )
}

export function FinancialTab({ financials, projectId }: { financials: Financials | null; projectId: string }) {
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Partial<Financials>>(financials ?? {})
  const [saving, setSaving] = useState(false)

  function handleChange(name: string, val: string) {
    setForm(prev => ({ ...prev, [name]: val === 'true' ? true : val === 'false' ? false : parseFloat(val) || val }))
  }

  const computed_total = (Number(form.estimated_epc_cost) || 0) +
    (Number(form.estimated_dev_costs) || 0) +
    (Number(form.estimated_ix_costs) || 0) +
    (Number(form.development_fee) || 0)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}/financials`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_cost: computed_total }),
    })
    setSaving(false)
    setEditMode(false)
  }

  if (!financials) return <div className="card p-6 text-[#94a3b8]">No financial data available.</div>

  const f = editMode ? { ...financials, ...form } : financials

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {editMode ? (
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="btn-secondary flex items-center gap-1.5"><X size={14} /> Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5"><Check size={14} /> {saving ? 'Saving...' : 'Save'}</button>
          </div>
        ) : (
          <button onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-1.5"><Edit size={14} /> Edit</button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Cost Breakdown</h3>
          {editMode ? (
            <>
              <EditRow label="EPC Cost" name="estimated_epc_cost" value={f.estimated_epc_cost} prefix="$" onChange={handleChange} />
              <EditRow label="Dev Costs" name="estimated_dev_costs" value={f.estimated_dev_costs} prefix="$" onChange={handleChange} />
              <EditRow label="IX Costs" name="estimated_ix_costs" value={f.estimated_ix_costs} prefix="$" onChange={handleChange} />
              <EditRow label="Development Fee" name="development_fee" value={f.development_fee} prefix="$" onChange={handleChange} />
              <div className="flex items-center justify-between py-2 mt-2 border-t border-[#e2e8f0]">
                <span className="text-xs font-bold uppercase tracking-wide text-[#2F3E50]">Total Cost</span>
                <span className="text-sm font-bold text-[#2F3E50]">{formatCurrency(computed_total)}</span>
              </div>
            </>
          ) : (
            <>
              <ViewRow label="EPC Cost" value={formatCurrency(f.estimated_epc_cost)} />
              <ViewRow label="Dev Costs" value={formatCurrency(f.estimated_dev_costs)} />
              <ViewRow label="IX Costs" value={formatCurrency(f.estimated_ix_costs)} />
              <ViewRow label="Development Fee" value={formatCurrency(f.development_fee)} />
              <ViewRow label="Total Cost" value={formatCurrency(f.total_cost)} />
              <ViewRow label="ITC Eligible" value={formatCurrency(f.itc_eligible_costs)} />
              <ViewRow label="ITC Ineligible" value={formatCurrency(f.itc_ineligible_costs)} />
            </>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Contract & Revenue</h3>
          <ViewRow label="Contract Type" value={f.contract_type} />
          <ViewRow label="Revenue Type" value={f.revenue_type} />
          <ViewRow label="Offtaker Credit" value={f.offtaker_credit} />
          <ViewRow label="Term" value={`${f.term_months / 12} years`} />
          <ViewRow label="Year 1 Price" value={`$${f.year1_contract_price}/kWh`} />
          <ViewRow label="Escalation Rate" value={`${f.escalation_rate}%`} />
          <ViewRow label="SREC Treatment" value={f.srec_treatment} />
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Tax & Incentives</h3>
          <ViewRow label="ITC Rate" value={`${f.itc_rate}%`} />
          <ViewRow label="Domestic Content" value={f.domestic_content_assumed ? 'Yes' : 'No'} />
          <ViewRow label="Safe Harbor Required" value={f.safe_harbor_required ? 'Yes' : 'No'} />
          <ViewRow label="Incentive Type" value={f.incentive_type} />
          <ViewRow label="Other Incentives" value={formatCurrency(f.other_incentives_total)} />
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Energy & Returns</h3>
          <ViewRow label="Avoided Cost" value={`$${f.avoided_cost_kwh}/kWh`} />
          <ViewRow label="Yield (kWh/kWp)" value={`${f.yield_kwh_kwp}`} />
          <ViewRow label="Year 1 Generation" value={`${f.energy_gen_year1_mwh} MWh`} />
          <ViewRow label="Annual Savings" value={f.annual_savings ? formatCurrency(f.annual_savings) : '—'} />
          <ViewRow label="Payback Years" value={f.payback_years ? `${f.payback_years} yrs` : '—'} />
        </div>
      </div>
    </div>
  )
}
