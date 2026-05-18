'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import { EditToolbar, ErrorBanner, FieldGrid, Field, FieldInput, FieldSelect } from './_editFields'

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

type Section = 'cost' | 'transaction' | 'tax'

const CONTRACT_TYPES = ['Energy Services Agreement', 'Power Purchase Agreement', 'Lease', 'Cash Sale']
const REVENUE_TYPES = ['Fixed Rate with Escalator', 'Fixed Rate', 'Indexed', 'Avoided Cost']
const OFFTAKER_CREDITS = ['AAA', 'AA - IG', 'A - IG', 'BBB - IG', 'BB', 'Unrated']
const SREC_TREATMENTS = ['Offtaker Retains', 'Developer Retains', 'REC Arbitrage', 'Not Applicable']
const INCENTIVE_TYPES = ['None', 'State', 'Federal', 'Utility', 'Local']

// ── Excel-style cost breakdown table ─────────────────────────────────────
function CostBreakdownTable({
  editing,
  f,
  form,
  setForm,
  systemKwdc,
}: {
  editing: boolean
  f: Financials
  form: { estimated_epc_cost: number; estimated_dev_costs: number; estimated_ix_costs: number; development_fee: number }
  setForm: (updater: (prev: typeof form) => typeof form) => void
  systemKwdc: number
}) {
  const rows = [
    { key: 'estimated_epc_cost', label: 'EPC Cost', desc: 'Engineering, procurement, construction' },
    { key: 'estimated_dev_costs', label: 'Development Costs', desc: 'Soft costs, permitting, legal' },
    { key: 'estimated_ix_costs', label: 'Interconnection Costs', desc: 'Utility study + IX upgrades' },
    { key: 'development_fee', label: 'Development Fee', desc: 'Developer margin' },
  ] as const

  const current = editing ? form : {
    estimated_epc_cost: f.estimated_epc_cost,
    estimated_dev_costs: f.estimated_dev_costs,
    estimated_ix_costs: f.estimated_ix_costs,
    development_fee: f.development_fee,
  }
  const total = (Number(current.estimated_epc_cost) || 0)
    + (Number(current.estimated_dev_costs) || 0)
    + (Number(current.estimated_ix_costs) || 0)
    + (Number(current.development_fee) || 0)
  const epcPct = total > 0 ? Math.round((Number(current.estimated_epc_cost) || 0) / total * 100) : 0
  const devPct = total > 0 ? Math.round((Number(current.estimated_dev_costs) || 0) / total * 100) : 0
  const ixPct  = total > 0 ? Math.round((Number(current.estimated_ix_costs) || 0) / total * 100) : 0
  const feePct = total > 0 ? Math.round((Number(current.development_fee) || 0) / total * 100) : 0
  const pctMap: Record<string, number> = {
    estimated_epc_cost: epcPct,
    estimated_dev_costs: devPct,
    estimated_ix_costs: ixPct,
    development_fee: feePct,
  }

  // $/W = dollars per watt = amount / (system_kwdc * 1000)
  const watts = (systemKwdc || 0) * 1000
  const dollarPerWatt = (amount: number) => watts > 0 ? amount / watts : 0
  const fmtDpw = (amount: number) => watts > 0 ? `$${dollarPerWatt(amount).toFixed(2)}` : '—'

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-[#e2e8f0] bg-[#fafafa]">
          <th className="text-left px-4 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Line Item</th>
          <th className="text-right px-4 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider w-[80px]">% of Total</th>
          <th className="text-right px-4 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider w-[80px]">$/W</th>
          <th className="text-right px-4 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider w-[170px]">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const value = (current as Record<string, number>)[r.key] ?? 0
          return (
            <tr key={r.key} className="border-b border-[#f1f5f9]">
              <td className="px-4 py-2.5">
                <div className="text-[13px] font-medium text-[#181818]">{r.label}</div>
                <div className="text-[11px] text-[#706E6B]">{r.desc}</div>
              </td>
              <td className="px-4 py-2.5 text-right text-[12px] text-[#706E6B]">
                {pctMap[r.key]}%
              </td>
              <td className="px-4 py-2.5 text-right text-[12px] text-[#706E6B]">
                {fmtDpw(value)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {editing ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-[12px] text-[#706E6B]">$</span>
                    <input
                      type="number"
                      value={value || ''}
                      onChange={e => setForm(prev => ({ ...prev, [r.key]: Number(e.target.value) || 0 } as typeof prev))}
                      className="w-[120px] px-2 py-1 text-right text-[13px] border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                    />
                  </div>
                ) : (
                  <span className="text-[13px] text-[#181818]">{formatCurrency(value)}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="bg-[#F3F2F2] border-t-2 border-[#e2e8f0]">
          <td className="px-4 py-3 text-[12px] font-bold text-[#181818] uppercase tracking-wider">Total Cost</td>
          <td className="px-4 py-3 text-right text-[12px] text-[#706E6B]">100%</td>
          <td className="px-4 py-3 text-right text-[12px] font-semibold text-[#181818]">{fmtDpw(total)}</td>
          <td className="px-4 py-3 text-right text-[14px] font-bold text-[#181818]">{formatCurrency(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

// ── Section wrapper with own edit toggle ─────────────────────────────────
function SectionCard({
  title, editing, saving, onEdit, onCancel, onSave, error, children,
}: {
  title: string
  editing: boolean
  saving: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#181818]">{title}</h3>
        <EditToolbar editMode={editing} saving={saving} onEdit={onEdit} onCancel={onCancel} onSave={onSave} />
      </div>
      <div>{children}</div>
      <ErrorBanner error={error} />
    </div>
  )
}

export function FinancialTab({ financials, projectId, systemKwdc = 0 }: { financials: Financials | null; projectId: string; systemKwdc?: number }) {
  const router = useRouter()
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-section forms
  const [costForm, setCostForm] = useState({
    estimated_epc_cost: financials?.estimated_epc_cost ?? 0,
    estimated_dev_costs: financials?.estimated_dev_costs ?? 0,
    estimated_ix_costs: financials?.estimated_ix_costs ?? 0,
    development_fee: financials?.development_fee ?? 0,
  })
  // Transaction Structure — contract terms + customer-facing economics
  const [transactionForm, setTransactionForm] = useState({
    contract_type: financials?.contract_type ?? '',
    revenue_type: financials?.revenue_type ?? '',
    offtaker_credit: financials?.offtaker_credit ?? '',
    term_months: financials?.term_months ?? 0,
    year1_contract_price: financials?.year1_contract_price ?? 0,
    escalation_rate: financials?.escalation_rate ?? 0,
    srec_treatment: financials?.srec_treatment ?? '',
    avoided_cost_kwh: financials?.avoided_cost_kwh ?? 0,
    annual_savings: financials?.annual_savings ?? 0,
  })
  const [taxForm, setTaxForm] = useState({
    itc_rate: financials?.itc_rate ?? 0,
    itc_eligible_costs: financials?.itc_eligible_costs ?? 0,
    itc_ineligible_costs: financials?.itc_ineligible_costs ?? 0,
    domestic_content_assumed: financials?.domestic_content_assumed ?? false,
    safe_harbor_required: financials?.safe_harbor_required ?? false,
    incentive_type: financials?.incentive_type ?? '',
    other_incentives_total: financials?.other_incentives_total ?? 0,
  })

  if (!financials) return <div className="card p-6 text-[#706E6B]">No financial data available.</div>
  const f = financials

  function startEdit(section: Section) {
    setError(null)
    if (section === 'cost') setCostForm({
      estimated_epc_cost: f.estimated_epc_cost ?? 0,
      estimated_dev_costs: f.estimated_dev_costs ?? 0,
      estimated_ix_costs: f.estimated_ix_costs ?? 0,
      development_fee: f.development_fee ?? 0,
    })
    if (section === 'transaction') setTransactionForm({
      contract_type: f.contract_type ?? '',
      revenue_type: f.revenue_type ?? '',
      offtaker_credit: f.offtaker_credit ?? '',
      term_months: f.term_months ?? 0,
      year1_contract_price: f.year1_contract_price ?? 0,
      escalation_rate: f.escalation_rate ?? 0,
      srec_treatment: f.srec_treatment ?? '',
      avoided_cost_kwh: f.avoided_cost_kwh ?? 0,
      annual_savings: f.annual_savings ?? 0,
    })
    if (section === 'tax') setTaxForm({
      itc_rate: f.itc_rate ?? 0,
      itc_eligible_costs: f.itc_eligible_costs ?? 0,
      itc_ineligible_costs: f.itc_ineligible_costs ?? 0,
      domestic_content_assumed: !!f.domestic_content_assumed,
      safe_harbor_required: !!f.safe_harbor_required,
      incentive_type: f.incentive_type ?? '',
      other_incentives_total: f.other_incentives_total ?? 0,
    })
    setEditingSection(section)
  }

  async function save(section: Section) {
    setSaving(true); setError(null)
    let payload: Record<string, unknown> = {}
    if (section === 'cost') payload = {
      estimated_epc_cost: Number(costForm.estimated_epc_cost) || 0,
      estimated_dev_costs: Number(costForm.estimated_dev_costs) || 0,
      estimated_ix_costs: Number(costForm.estimated_ix_costs) || 0,
      development_fee: Number(costForm.development_fee) || 0,
    }
    if (section === 'transaction') payload = {
      contract_type: transactionForm.contract_type,
      revenue_type: transactionForm.revenue_type,
      offtaker_credit: transactionForm.offtaker_credit,
      term_months: Number(transactionForm.term_months) || 0,
      year1_contract_price: Number(transactionForm.year1_contract_price) || 0,
      escalation_rate: Number(transactionForm.escalation_rate) || 0,
      srec_treatment: transactionForm.srec_treatment,
      avoided_cost_kwh: Number(transactionForm.avoided_cost_kwh) || 0,
      annual_savings: Number(transactionForm.annual_savings) || 0,
    }
    if (section === 'tax') payload = {
      itc_rate: Number(taxForm.itc_rate) || 0,
      itc_eligible_costs: Number(taxForm.itc_eligible_costs) || 0,
      itc_ineligible_costs: Number(taxForm.itc_ineligible_costs) || 0,
      domestic_content_assumed: !!taxForm.domestic_content_assumed,
      safe_harbor_required: !!taxForm.safe_harbor_required,
      incentive_type: taxForm.incentive_type,
      other_incentives_total: Number(taxForm.other_incentives_total) || 0,
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/financials`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setEditingSection(null)
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
    <div className="grid grid-cols-2 gap-5">
      {/* Cost Breakdown — full width as an Excel-style table */}
      <div className="col-span-2">
        <SectionCard
          title="Cost Breakdown"
          editing={editingSection === 'cost'}
          saving={saving}
          onEdit={() => startEdit('cost')}
          onCancel={() => { setEditingSection(null); setError(null) }}
          onSave={() => save('cost')}
          error={editingSection === 'cost' ? error : null}
        >
          <CostBreakdownTable
            editing={editingSection === 'cost'}
            f={f}
            form={costForm}
            setForm={setCostForm}
            systemKwdc={systemKwdc}
          />
        </SectionCard>
      </div>

      {/* Transaction Structure — contract terms + customer-facing economics */}
      <SectionCard
        title="Transaction Structure"
        editing={editingSection === 'transaction'}
        saving={saving}
        onEdit={() => startEdit('transaction')}
        onCancel={() => { setEditingSection(null); setError(null) }}
        onSave={() => save('transaction')}
        error={editingSection === 'transaction' ? error : null}
      >
        <div>
          {(() => {
            const editing = editingSection === 'transaction'
            return (
              <FieldGrid>
                <Field label="Contract Type">
                  {editing
                    ? <FieldSelect value={transactionForm.contract_type} options={CONTRACT_TYPES} onChange={v => setTransactionForm(p => ({ ...p, contract_type: v }))} />
                    : (f.contract_type || '—')}
                </Field>
                <Field label="Revenue Type">
                  {editing
                    ? <FieldSelect value={transactionForm.revenue_type} options={REVENUE_TYPES} onChange={v => setTransactionForm(p => ({ ...p, revenue_type: v }))} />
                    : (f.revenue_type || '—')}
                </Field>
                <Field label="Offtaker Credit">
                  {editing
                    ? <FieldSelect value={transactionForm.offtaker_credit} options={OFFTAKER_CREDITS} onChange={v => setTransactionForm(p => ({ ...p, offtaker_credit: v }))} />
                    : (f.offtaker_credit || '—')}
                </Field>
                <Field label="Term">
                  {editing
                    ? <FieldInput type="number" value={transactionForm.term_months} onChange={v => setTransactionForm(p => ({ ...p, term_months: Number(v) as unknown as number }))} suffix="months" />
                    : (f.term_months ? `${f.term_months} months (${(f.term_months / 12).toFixed(1)} yrs)` : '—')}
                </Field>
                <Field label="Year 1 Price">
                  {editing
                    ? <FieldInput type="number" value={transactionForm.year1_contract_price} onChange={v => setTransactionForm(p => ({ ...p, year1_contract_price: Number(v) as unknown as number }))} suffix="$/kWh" />
                    : (f.year1_contract_price ? `$${f.year1_contract_price}/kWh` : '—')}
                </Field>
                <Field label="Escalation Rate">
                  {editing
                    ? <FieldInput type="number" value={transactionForm.escalation_rate} onChange={v => setTransactionForm(p => ({ ...p, escalation_rate: Number(v) as unknown as number }))} suffix="%" />
                    : `${f.escalation_rate}%`}
                </Field>
                <Field label="SREC Treatment" full>
                  {editing
                    ? <FieldSelect value={transactionForm.srec_treatment} options={SREC_TREATMENTS} onChange={v => setTransactionForm(p => ({ ...p, srec_treatment: v }))} />
                    : (f.srec_treatment || '—')}
                </Field>
                <Field label="Avoided Cost">
                  {editing
                    ? <FieldInput type="number" value={transactionForm.avoided_cost_kwh} onChange={v => setTransactionForm(p => ({ ...p, avoided_cost_kwh: Number(v) as unknown as number }))} suffix="$/kWh" />
                    : (f.avoided_cost_kwh ? `$${f.avoided_cost_kwh}/kWh` : '—')}
                </Field>
                <Field label="Annual Savings">
                  {editing
                    ? <FieldInput type="number" value={transactionForm.annual_savings} onChange={v => setTransactionForm(p => ({ ...p, annual_savings: Number(v) as unknown as number }))} suffix="$" />
                    : (f.annual_savings ? formatCurrency(f.annual_savings) : '—')}
                </Field>
              </FieldGrid>
            )
          })()}
        </div>
      </SectionCard>

      {/* Tax & Incentives */}
      <SectionCard
        title="Tax & Incentives"
        editing={editingSection === 'tax'}
        saving={saving}
        onEdit={() => startEdit('tax')}
        onCancel={() => { setEditingSection(null); setError(null) }}
        onSave={() => save('tax')}
        error={editingSection === 'tax' ? error : null}
      >
        <div>
          {(() => {
            const editing = editingSection === 'tax'
            return (
              <FieldGrid>
                <Field label="ITC Rate">
                  {editing
                    ? <FieldInput type="number" value={taxForm.itc_rate} onChange={v => setTaxForm(p => ({ ...p, itc_rate: Number(v) as unknown as number }))} suffix="%" />
                    : `${f.itc_rate}%`}
                </Field>
                <Field label="Incentive Type">
                  {editing
                    ? <FieldSelect value={taxForm.incentive_type} options={INCENTIVE_TYPES} onChange={v => setTaxForm(p => ({ ...p, incentive_type: v }))} />
                    : (f.incentive_type || '—')}
                </Field>
                <Field label="ITC Eligible Costs">
                  {editing
                    ? <FieldInput type="number" value={taxForm.itc_eligible_costs} onChange={v => setTaxForm(p => ({ ...p, itc_eligible_costs: Number(v) as unknown as number }))} suffix="$" />
                    : formatCurrency(f.itc_eligible_costs)}
                </Field>
                <Field label="ITC Ineligible Costs">
                  {editing
                    ? <FieldInput type="number" value={taxForm.itc_ineligible_costs} onChange={v => setTaxForm(p => ({ ...p, itc_ineligible_costs: Number(v) as unknown as number }))} suffix="$" />
                    : formatCurrency(f.itc_ineligible_costs)}
                </Field>
                <Field label="Other Incentives" full>
                  {editing
                    ? <FieldInput type="number" value={taxForm.other_incentives_total} onChange={v => setTaxForm(p => ({ ...p, other_incentives_total: Number(v) as unknown as number }))} suffix="$" />
                    : formatCurrency(f.other_incentives_total)}
                </Field>
                <Field label="Domestic Content">
                  {editing ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={taxForm.domestic_content_assumed}
                        onChange={e => setTaxForm(p => ({ ...p, domestic_content_assumed: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#cbd5e1]" />
                      <span className="text-[13px] text-[#181818]">Assumed</span>
                    </label>
                  ) : (f.domestic_content_assumed ? 'Yes' : 'No')}
                </Field>
                <Field label="Safe Harbor">
                  {editing ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={taxForm.safe_harbor_required}
                        onChange={e => setTaxForm(p => ({ ...p, safe_harbor_required: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#cbd5e1]" />
                      <span className="text-[13px] text-[#181818]">Required</span>
                    </label>
                  ) : (f.safe_harbor_required ? 'Yes' : 'No')}
                </Field>
              </FieldGrid>
            )
          })()}
        </div>
      </SectionCard>

    </div>
  )
}
