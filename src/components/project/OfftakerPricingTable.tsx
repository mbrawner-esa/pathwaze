'use client'
/**
 * Offtaker Pricing — versioned proposal options for the customer offtake.
 *
 * Each row is a full proposal organized into four sections:
 *   1. Project Information   — linked systems, computed size + Year-1 energy,
 *                              estimated NTP / COD
 *   2. Utility Savings       — per-meter electric bill savings (user-entered),
 *                              computed per-meter and blended avoided cost
 *   3. Contract Terms        — revenue type, term, escalator, year-1 price,
 *                              computed Year-1 net savings, customer term
 *                              savings + NPV (user-entered)
 *   4. Environmental Attributes — SREC treatment, computed total SRECs
 *
 * One row per project may be marked is_selected (the customer's accepted
 * proposal). Contract Type + Offtaker Credit live separately on the project's
 * Tax & Incentives section (project_financials).
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Star, Trash2, X, Send, MessageSquare, Pencil } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

const REVENUE_TYPES = ['Fixed Rate with Escalator', 'Fixed Rate', 'Indexed', 'Avoided Cost']
const SREC_TREATMENTS = ['Offtaker Retains', 'Developer Retains', 'REC Arbitrage', 'Not Applicable']

export interface PricingRow {
  id: string
  project_id: string
  version_label: string
  is_selected: boolean
  // Project Information
  linked_system_ids: string[] | null
  estimated_ntp: string | null
  estimated_cod: string | null
  // Utility Savings
  meter_savings: Record<string, number> | null
  utility_escalation_rate: number | null
  // Contract Terms
  revenue_type: string | null
  term_months: number | null
  escalation_rate: number | null
  year1_contract_price: number | null
  customer_term_savings: number | null
  customer_term_npv: number | null
  // Environmental Attributes
  srec_treatment: string | null
  // Misc
  notes: string | null
  created_at: string
  updated_at: string
}

interface SystemRow {
  id: string
  name: string
  size_kwdc: number | null
  annual_production_kwh: number | null
  meter_id: string | null
  building_id: string | null
}

interface MeterRow {
  id: string
  meter_num: string | null
  account_num: string | null
  building_id: string | null
}

interface ThreadEntry {
  id: string
  row_id: string
  user_id: string | null
  user_name: string | null
  user_avatar_url: string | null
  message: string
  created_at: string
}

export function OfftakerPricingTable({
  projectId,
  initialRows,
  systems = [],
  meters = [],
}: {
  projectId: string
  initialRows: PricingRow[]
  systems?: SystemRow[]
  meters?: MeterRow[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<PricingRow[]>(initialRows)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<PricingRow>>({})

  // Threads
  const [threads, setThreads] = useState<ThreadEntry[]>([])
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [newMessage, setNewMessage] = useState('')

  const open = rows.find(r => r.id === openId) ?? null

  const loadThreads = useCallback(async (rowId: string) => {
    setLoadingThreads(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/offtaker-pricing/${rowId}/threads`)
      if (res.ok) setThreads(await res.json())
    } catch { /* ignore */ }
    setLoadingThreads(false)
  }, [projectId])

  useEffect(() => {
    if (openId) loadThreads(openId)
    else { setThreads([]); setEditing(false); setErr(null) }
  }, [openId, loadThreads])

  // ── Computed values for the open row ────────────────────────────────
  // These compute live as the user edits, so the user sees the impact
  // of changes before saving.
  function getCalcSource(): PricingRow | Partial<PricingRow> {
    return editing ? { ...open, ...editForm } : (open ?? {})
  }

  function linkedSystems(): SystemRow[] {
    const src = getCalcSource()
    const ids = (src.linked_system_ids ?? []) as string[]
    return systems.filter(s => ids.includes(s.id))
  }

  function linkedMeters(): MeterRow[] {
    // Meters linked to any of the linked systems via systems.meter_id.
    const ls = linkedSystems()
    const meterIds = new Set(ls.map(s => s.meter_id).filter(Boolean) as string[])
    return meters.filter(m => meterIds.has(m.id))
  }

  function totalSystemKwdc(): number {
    return linkedSystems().reduce((sum, s) => sum + (s.size_kwdc ?? 0), 0)
  }

  function totalYear1Production(): number {
    return linkedSystems().reduce((sum, s) => sum + (s.annual_production_kwh ?? 0), 0)
  }

  function meterProductionShare(meterId: string): number {
    // Production attributed to a meter = sum of its linked systems' Year-1 production.
    const ls = linkedSystems()
    return ls
      .filter(s => s.meter_id === meterId)
      .reduce((sum, s) => sum + (s.annual_production_kwh ?? 0), 0)
  }

  function meterSavings(meterId: string): number {
    const src = getCalcSource()
    const m = (src.meter_savings ?? {}) as Record<string, number>
    return Number(m[meterId] ?? 0)
  }

  function meterAvoidedCost(meterId: string): number {
    const prod = meterProductionShare(meterId)
    if (!prod) return 0
    return meterSavings(meterId) / prod
  }

  function totalElectricBillSavings(): number {
    return linkedMeters().reduce((sum, m) => sum + meterSavings(m.id), 0)
  }

  function blendedAvoidedCost(): number {
    const prod = totalYear1Production()
    if (!prod) return 0
    return totalElectricBillSavings() / prod
  }

  function year1NetSavings(): number {
    const src = getCalcSource()
    const price = Number(src.year1_contract_price ?? 0)
    return totalElectricBillSavings() - (price * totalYear1Production())
  }

  function totalSRECs(): number {
    return totalYear1Production() / 1000
  }

  function fmtKwh(n: number): string {
    if (!n) return '0 kWh'
    return `${Math.round(n).toLocaleString()} kWh`
  }
  function fmtKwdc(n: number): string {
    if (!n) return '0 kWdc'
    return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} kWdc`
  }
  function fmtRate(n: number): string {
    return `$${n.toFixed(4)}/kWh`
  }

  // ── Mutations ────────────────────────────────────────────────────────

  async function addOption() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/offtaker-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const created = await res.json()
        setRows(prev => [...prev, created])
        setOpenId(created.id)
        startEdit(created)
        router.refresh()
      } else {
        const b = await res.json().catch(() => ({}))
        setErr(b?.error || 'Failed to add option')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(false)
  }

  function startEdit(r: PricingRow) {
    setEditForm({
      ...r,
      // Defensive: arrays + objects must be cloned so editing doesn't mutate state
      linked_system_ids: [...(r.linked_system_ids ?? [])],
      meter_savings: { ...(r.meter_savings ?? {}) },
    })
    setEditing(true)
    setErr(null)
  }

  async function saveEdit() {
    if (!open) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/offtaker-pricing/${open.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        const updated = await res.json()
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        setEditing(false)
        router.refresh()
      } else {
        const b = await res.json().catch(() => ({}))
        setErr(b?.error || 'Save failed')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(false)
  }

  async function toggleSelected(r: PricingRow) {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/offtaker-pricing/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_selected: !r.is_selected }),
      })
      if (res.ok) {
        const updated = await res.json()
        setRows(prev => prev.map(x => x.id === updated.id ? updated : (updated.is_selected ? { ...x, is_selected: false } : x)))
        router.refresh()
      } else {
        const b = await res.json().catch(() => ({}))
        setErr(b?.error || 'Save failed')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(false)
  }

  async function deleteRow(rowId: string) {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/offtaker-pricing/${rowId}`, { method: 'DELETE' })
      if (res.ok) {
        setRows(prev => prev.filter(r => r.id !== rowId))
        setOpenId(null)
        router.refresh()
      } else {
        const b = await res.json().catch(() => ({}))
        setErr(b?.error || 'Delete failed')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(false)
  }

  async function sendThread() {
    if (!open || !newMessage.trim()) return
    const res = await fetch(`/api/projects/${projectId}/offtaker-pricing/${open.id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage }),
    })
    if (res.ok) {
      const created = await res.json()
      setThreads(prev => [...prev, created])
      setNewMessage('')
    }
  }

  // ── Per-row table values ─────────────────────────────────────────────
  // These compute from the saved data (not editForm) — used for the
  // collapsed table view.

  function rowSystemCount(r: PricingRow): number {
    return (r.linked_system_ids ?? []).length
  }
  function rowSystemKwdc(r: PricingRow): number {
    const ids = r.linked_system_ids ?? []
    return systems.filter(s => ids.includes(s.id)).reduce((s, sy) => s + (sy.size_kwdc ?? 0), 0)
  }
  function rowTotalSavings(r: PricingRow): number {
    return Object.values(r.meter_savings ?? {}).reduce((s, v) => s + Number(v), 0)
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-[#181818]">Offtaker Pricing</h3>
          <p className="text-[11.5px] text-[#706E6B] mt-0.5">{rows.length} {rows.length === 1 ? 'option' : 'options'} · Track proposal versions for the customer</p>
        </div>
        <button
          onClick={addOption}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-white bg-[#70A0D0] rounded hover:bg-[#2C5485] transition-colors disabled:opacity-50"
        >
          <Plus size={13} /> Add option
        </button>
      </div>

      {err && !openId && (
        <div className="px-6 py-2.5 bg-[#fef2f2] border-b border-[#fecaca] text-[12px] text-[#991b1b]">{err}</div>
      )}

      {rows.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[13px] text-[#706E6B] mb-3">No pricing options yet.</p>
          <button
            onClick={addOption}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold text-[#2C5485] hover:underline"
          >
            <Plus size={13} /> Add the first option
          </button>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-5 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Option</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Systems</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Size</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Term</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Yr 1 Price</th>
              <th className="text-left px-3 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Total Savings</th>
              <th className="text-right px-5 py-2.5 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Selected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className={`border-b border-[#f1f5f9] cursor-pointer hover:bg-[#f8fafc] ${r.is_selected ? 'bg-[#FFFBEB]/50' : ''}`}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {r.is_selected && <Star size={12} className="text-[#E6C87A]" fill="#E6C87A" />}
                    <span className="text-[13px] font-medium text-[#181818]">{r.version_label}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowSystemCount(r) || '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowSystemKwdc(r) ? fmtKwdc(rowSystemKwdc(r)) : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{r.term_months ? `${r.term_months} mo` : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{r.year1_contract_price != null ? `$${Number(r.year1_contract_price).toFixed(4)}/kWh` : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowTotalSavings(r) ? formatCurrency(rowTotalSavings(r)) : '—'}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); toggleSelected(r) }}
                    disabled={busy}
                    title={r.is_selected ? 'Unselect' : 'Mark as selected proposal'}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${r.is_selected ? 'bg-[#E6C87A]/30 text-[#92400E]' : 'bg-[#f1f5f9] text-[#706E6B] hover:bg-[#e2e8f0]'}`}
                  >
                    <Star size={10} fill={r.is_selected ? '#E6C87A' : 'none'} />
                    {r.is_selected ? 'Selected' : 'Select'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Drawer */}
      {open && (
        <>
          <div onClick={() => setOpenId(null)} className="fixed inset-0 bg-black/30 z-40" />
          <div className="fixed top-[52px] right-0 bottom-0 z-50 bg-white w-full max-w-[720px] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#e2e8f0] bg-white">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-[#706E6B] uppercase tracking-[0.08em]">Pricing option</span>
                    {open.is_selected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: '#E6C87A', color: '#92400E' }}>
                        <Star size={9} fill="#92400E" /> Selected
                      </span>
                    )}
                  </div>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.version_label ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, version_label: e.target.value }))}
                      className="w-full text-[18px] font-semibold text-[#181818] bg-white border border-[#cbd5e1] rounded px-2 py-1 focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                    />
                  ) : (
                    <h2 className="text-[18px] font-semibold text-[#181818]">{open.version_label}</h2>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editing ? (
                    <>
                      <button
                        onClick={() => { if (confirm(`Delete "${open.version_label}"?`)) deleteRow(open.id) }}
                        disabled={busy}
                        className="px-2.5 py-1 text-[12px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] rounded inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                      <button onClick={() => setEditing(false)} disabled={busy} className="btn-secondary">Cancel</button>
                      <button onClick={saveEdit} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => toggleSelected(open)}
                        disabled={busy}
                        title={open.is_selected ? 'Unselect this option' : 'Mark this as the selected proposal'}
                        className="px-2.5 py-1 text-[12px] font-semibold inline-flex items-center gap-1 rounded transition-colors"
                        style={{
                          background: open.is_selected ? '#E6C87A' : '#f1f5f9',
                          color: open.is_selected ? '#92400E' : '#3E3E3C',
                        }}
                      >
                        <Star size={11} fill={open.is_selected ? '#92400E' : 'none'} />
                        {open.is_selected ? 'Selected' : 'Mark selected'}
                      </button>
                      <button onClick={() => startEdit(open)} title="Edit" className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors">
                        <Pencil size={16} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setOpenId(null)} className="text-[#706E6B] hover:text-[#181818] hover:bg-[#F3F2F2] p-1.5 rounded transition-colors">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 bg-[#fafbfc] space-y-5">

              {/* ───────────────────── 1. Project Information ───────────────────── */}
              <SectionShell title="Project Information">
                <div className="px-5 py-4 space-y-4">
                  <FieldCell label="Linked systems" full>
                    {editing ? (
                      <div className="space-y-1">
                        {systems.length === 0 ? (
                          <p className="text-[12px] text-[#A8A8A8] italic">No systems on this project yet.</p>
                        ) : systems.map(s => {
                          const checked = (editForm.linked_system_ids ?? []).includes(s.id)
                          return (
                            <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const cur = editForm.linked_system_ids ?? []
                                  const next = e.target.checked ? [...cur, s.id] : cur.filter(x => x !== s.id)
                                  setEditForm(f => ({ ...f, linked_system_ids: next }))
                                }}
                                className="w-4 h-4 rounded border-[#cbd5e1]"
                              />
                              <span className="text-[13px] text-[#181818]">{s.name}</span>
                              <span className="text-[11.5px] text-[#706E6B]">· {fmtKwdc(s.size_kwdc ?? 0)} · {fmtKwh(s.annual_production_kwh ?? 0)}/yr</span>
                            </label>
                          )
                        })}
                      </div>
                    ) : linkedSystems().length === 0 ? (
                      <span className="text-[13px] text-[#A8A8A8] italic">None linked</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {linkedSystems().map(s => (
                          <li key={s.id} className="text-[13px] text-[#181818]">
                            {s.name}
                            <span className="text-[11.5px] text-[#706E6B] ml-2">· {fmtKwdc(s.size_kwdc ?? 0)} · {fmtKwh(s.annual_production_kwh ?? 0)}/yr</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </FieldCell>
                  <div className="grid grid-cols-2 gap-4">
                    <CalcField label="System size DC" value={fmtKwdc(totalSystemKwdc())} />
                    <CalcField label="Year 1 energy production" value={fmtKwh(totalYear1Production())} />
                    <FieldCell label="Estimated NTP">
                      {editing
                        ? <DateInput value={editForm.estimated_ntp ?? ''} onChange={v => setEditForm(f => ({ ...f, estimated_ntp: v || null }))} />
                        : (open.estimated_ntp ? formatDate(open.estimated_ntp) : '—')}
                    </FieldCell>
                    <FieldCell label="Estimated COD">
                      {editing
                        ? <DateInput value={editForm.estimated_cod ?? ''} onChange={v => setEditForm(f => ({ ...f, estimated_cod: v || null }))} />
                        : (open.estimated_cod ? formatDate(open.estimated_cod) : '—')}
                    </FieldCell>
                  </div>
                </div>
              </SectionShell>

              {/* ───────────────────── 2. Utility Savings ───────────────────── */}
              <SectionShell title="Utility Savings">
                <div className="px-5 py-4 space-y-4">
                  {linkedMeters().length === 0 ? (
                    <p className="text-[12.5px] text-[#A8A8A8] italic">Link a system that has an attached meter to compute utility savings.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#f1f5f9]">
                          <th className="text-left py-2 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Meter</th>
                          <th className="text-right py-2 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Production (kWh)</th>
                          <th className="text-right py-2 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Bill Savings ($)</th>
                          <th className="text-right py-2 text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider">Avoided Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedMeters().map(m => {
                          const label = m.meter_num || m.account_num || m.id.slice(0, 8)
                          return (
                            <tr key={m.id} className="border-b border-[#f1f5f9] last:border-b-0">
                              <td className="py-2 text-[13px] text-[#181818]">{label}</td>
                              <td className="py-2 text-right text-[13px] text-[#3E3E3C]">{fmtKwh(meterProductionShare(m.id))}</td>
                              <td className="py-2 text-right">
                                {editing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={meterSavings(m.id) || ''}
                                    onChange={e => {
                                      const cur = editForm.meter_savings ?? {}
                                      setEditForm(f => ({ ...f, meter_savings: { ...cur, [m.id]: Number(e.target.value) || 0 } }))
                                    }}
                                    className="w-28 px-2 py-1 text-[13px] text-right border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0]"
                                  />
                                ) : (
                                  <span className="text-[13px] text-[#181818]">{formatCurrency(meterSavings(m.id))}</span>
                                )}
                              </td>
                              <td className="py-2 text-right text-[13px] text-[#3E3E3C]">{meterAvoidedCost(m.id) > 0 ? fmtRate(meterAvoidedCost(m.id)) : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t border-[#f1f5f9]">
                    <CalcField label="Total electric bill savings" value={formatCurrency(totalElectricBillSavings())} />
                    <CalcField label="Blended avoided cost" value={blendedAvoidedCost() > 0 ? fmtRate(blendedAvoidedCost()) : '—'} />
                    <FieldCell label="Utility escalation">
                      {editing
                        ? <NumberInput value={editForm.utility_escalation_rate ?? 5} onChange={v => setEditForm(f => ({ ...f, utility_escalation_rate: v }))} suffix="%" />
                        : `${open.utility_escalation_rate ?? 5}%`}
                    </FieldCell>
                  </div>
                </div>
              </SectionShell>

              {/* ───────────────────── 3. Contract Terms ───────────────────── */}
              <SectionShell title="Contract Terms">
                <div className="px-5 py-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <FieldCell label="Contract term">
                    {editing
                      ? <NumberInput value={editForm.term_months ?? 0} onChange={v => setEditForm(f => ({ ...f, term_months: v }))} suffix="months" />
                      : (open.term_months ? `${open.term_months} months (${(open.term_months / 12).toFixed(1)} yrs)` : '—')}
                  </FieldCell>
                  <FieldCell label="Revenue type">
                    {editing
                      ? <SelectInput value={editForm.revenue_type ?? ''} options={REVENUE_TYPES} onChange={v => setEditForm(f => ({ ...f, revenue_type: v }))} />
                      : (open.revenue_type || '—')}
                  </FieldCell>
                  <FieldCell label="Escalation rate">
                    {editing
                      ? <NumberInput value={editForm.escalation_rate ?? 0} onChange={v => setEditForm(f => ({ ...f, escalation_rate: v }))} suffix="%" />
                      : (open.escalation_rate != null ? `${open.escalation_rate}%` : '—')}
                  </FieldCell>
                  <FieldCell label="Year 1 price">
                    {editing
                      ? <NumberInput value={editForm.year1_contract_price ?? 0} decimals={4} onChange={v => setEditForm(f => ({ ...f, year1_contract_price: v }))} suffix="$/kWh" />
                      : (open.year1_contract_price != null ? `$${Number(open.year1_contract_price).toFixed(4)}/kWh` : '—')}
                  </FieldCell>
                  <CalcField label="Year 1 net savings" value={formatCurrency(year1NetSavings())} />
                  <FieldCell label="Customer term savings">
                    {editing
                      ? <NumberInput value={editForm.customer_term_savings ?? 0} onChange={v => setEditForm(f => ({ ...f, customer_term_savings: v }))} suffix="$" />
                      : (open.customer_term_savings != null ? formatCurrency(open.customer_term_savings) : '—')}
                  </FieldCell>
                  <FieldCell label="Customer term NPV" full>
                    {editing
                      ? <NumberInput value={editForm.customer_term_npv ?? 0} onChange={v => setEditForm(f => ({ ...f, customer_term_npv: v }))} suffix="$" />
                      : (open.customer_term_npv != null ? formatCurrency(open.customer_term_npv) : '—')}
                  </FieldCell>
                </div>
              </SectionShell>

              {/* ───────────────────── 4. Environmental Attributes ───────────────────── */}
              <SectionShell title="Environmental Attributes">
                <div className="px-5 py-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <FieldCell label="SREC treatment">
                    {editing
                      ? <SelectInput value={editForm.srec_treatment ?? ''} options={SREC_TREATMENTS} onChange={v => setEditForm(f => ({ ...f, srec_treatment: v }))} />
                      : (open.srec_treatment || '—')}
                  </FieldCell>
                  <CalcField label="Total SRECs" value={totalSRECs() > 0 ? `${totalSRECs().toLocaleString(undefined, { maximumFractionDigits: 1 })} SRECs/yr` : '—'} />
                </div>
              </SectionShell>

              {/* Notes */}
              <SectionShell title="Notes">
                <div className="px-5 py-4">
                  {editing ? (
                    <textarea
                      value={editForm.notes ?? ''}
                      onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                      rows={5}
                      placeholder="Internal notes about this proposal — assumptions, customer feedback, comparison points, etc."
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded text-[13px] text-[#181818] resize-none focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                    />
                  ) : open.notes ? (
                    <p className="text-[13px] text-[#181818] whitespace-pre-wrap">{open.notes}</p>
                  ) : (
                    <p className="text-[12.5px] text-[#A8A8A8] italic">No notes yet.</p>
                  )}
                </div>
              </SectionShell>

              {err && (
                <div className="px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>
              )}

              {/* Threads */}
              <SectionShell title={
                <span className="inline-flex items-center gap-2"><MessageSquare size={12} /> Threads <span className="text-[11px] text-[#706E6B] font-normal">{threads.length}</span></span>
              }>
                <div className="px-5 py-4">
                  {loadingThreads ? (
                    <p className="text-xs text-[#706E6B]">Loading…</p>
                  ) : (
                    <div className="space-y-3 mb-3">
                      {threads.map(t => (
                        <div key={t.id} className="flex gap-2.5">
                          <Avatar name={t.user_name ?? 'User'} imageUrl={t.user_avatar_url} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[13px] font-semibold text-[#181818]">{t.user_name ?? 'User'}</span>
                              <span className="text-[10.5px] text-[#706E6B]">{formatDate(t.created_at)}</span>
                            </div>
                            <p className="text-[13px] text-[#181818] mt-0.5 whitespace-pre-wrap">{t.message}</p>
                          </div>
                        </div>
                      ))}
                      {threads.length === 0 && <p className="text-xs text-[#706E6B] py-2">No messages yet — start a discussion about this proposal.</p>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThread() } }}
                      placeholder="Add a message…"
                      className="flex-1 px-3 py-2 border border-[#cbd5e1] rounded text-[13px] focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
                    />
                    <button onClick={sendThread} className="p-2 bg-[#70A0D0] text-white rounded hover:bg-[#2C5485] transition-colors">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </SectionShell>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────── Small inline helpers ───────────────────

function SectionShell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f1f5f9] bg-[#F3F2F2]">
        <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function FieldCell({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider mb-1">{label}</p>
      <div className="text-[13px] text-[#181818]">{children}</div>
    </div>
  )
}

function CalcField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider mb-1 flex items-center gap-1">
        {label}
        <span className="inline-block px-1 py-0 text-[8.5px] font-semibold bg-[#EFF6FF] text-[#1d4ed8] rounded">CALC</span>
      </p>
      <div className="text-[13px] text-[#181818] font-medium">{value}</div>
    </div>
  )
}

function SelectInput({ value, options, onChange }: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1 text-[13px] text-[#181818] bg-white border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
    >
      <option value="">—</option>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  )
}

function NumberInput({ value, onChange, suffix, decimals }: { value: number; onChange: (v: number) => void; suffix?: string; decimals?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step={decimals ? Math.pow(10, -decimals) : 'any'}
        value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-full px-2 py-1 text-[13px] text-[#181818] border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
      />
      {suffix && <span className="text-[11px] text-[#706E6B] flex-shrink-0">{suffix}</span>}
    </div>
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // value is ISO 'yyyy-mm-dd' or empty
  const v = value ? String(value).slice(0, 10) : ''
  return (
    <input
      type="date"
      value={v}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2 py-1 text-[13px] text-[#181818] border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
    />
  )
}
