'use client'
/**
 * Offtaker Pricing — versioned proposal options for the customer offtake.
 *
 * Drawer sections:
 *   1. Project Information      — linked systems (via "add related" picker),
 *                                 computed System Size DC + Year-1 energy,
 *                                 estimated NTP / COD, quote created date
 *   2. Utility Savings          — per-meter electric bill savings (user $),
 *                                 computed per-meter + blended avoided cost,
 *                                 editable utility escalation
 *   3. Contract Terms           — term, revenue type, year-1 price (currency
 *                                 input, 4 decimals), escalation rate
 *   4. Contract Performance     — computed Year-1 net savings, customer term
 *                                 savings + NPV (entered in $K thousands)
 *   5. Environmental Attributes — SREC treatment, computed total SRECs
 *
 * Plus Notes (with bullet/numbered-list rendering) and Threads.
 *
 * One row per project may be marked is_selected (the customer's accepted
 * proposal). Contract Type + Offtaker Credit live separately on the project's
 * Tax & Incentives section (project_financials).
 *
 * Each row = ONE proposal Option (auto-named "Option A", "Option B", …).
 * Edits to the same option increment an internal `version` counter; the
 * actual field-by-field history flows into the project activity feed via
 * activity_log entries written by the PATCH endpoint.
 */
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, X, Send, MessageSquare, Pencil, Info, Circle, CheckCircle2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { MessageText, type MentionUser } from '@/components/ui/MessageText'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { NotesRender } from '@/components/ui/NotesRender'

const REVENUE_TYPES = ['Fixed Rate with Escalator', 'Fixed Rate', 'Indexed', 'Avoided Cost']
const SREC_TREATMENTS = ['Offtaker Retains', 'Developer Retains', 'REC Arbitrage', 'Not Applicable']

export interface PricingRow {
  id: string
  project_id: string
  version_label: string
  version: number | null
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
  quote_created_at: string | null
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
  users = [],
}: {
  projectId: string
  initialRows: PricingRow[]
  systems?: SystemRow[]
  meters?: MeterRow[]
  users?: MentionUser[]
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

  // Add-system picker (replaces checkboxes)
  const [pendingSystemId, setPendingSystemId] = useState('')

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
    else { setThreads([]); setEditing(false); setErr(null); setPendingSystemId('') }
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
                    {r.is_selected && <CheckCircle2 size={13} className="text-[#10b981]" />}
                    <span className="text-[13px] font-medium text-[#181818]">{r.version_label}</span>
                    {r.version != null && r.version > 1 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">v{r.version}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowSystemCount(r) || '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowSystemKwdc(r) ? fmtKwdc(rowSystemKwdc(r)) : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{r.term_months ? `${r.term_months} mo` : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{r.year1_contract_price != null ? `$${Number(r.year1_contract_price).toFixed(4)}/kWh` : '—'}</td>
                <td className="px-3 py-3 text-[12.5px] text-[#3E3E3C]">{rowTotalSavings(r) ? formatCurrency(rowTotalSavings(r)) : '—'}</td>
                <td className="px-5 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (r.is_selected) {
                          if (confirm(`Unselect "${r.version_label}"?`)) toggleSelected(r)
                        } else {
                          if (confirm(`Mark "${r.version_label}" as the selected proposal?`)) toggleSelected(r)
                        }
                      }}
                      disabled={busy}
                      title={r.is_selected ? 'Unselect this proposal' : 'Mark as the selected proposal'}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${r.is_selected ? 'bg-[#D1FAE5] text-[#047857] hover:bg-[#A7F3D0]' : 'bg-white border border-[#cbd5e1] text-[#3E3E3C] hover:bg-[#fafbfc]'}`}
                    >
                      {r.is_selected ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                      {r.is_selected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (confirm(`Delete "${r.version_label}"?`)) deleteRow(r.id)
                      }}
                      disabled={busy}
                      title="Delete proposal"
                      className="p-1 text-[#94a3b8] hover:text-[#dc2626] hover:bg-[#fef2f2] rounded transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
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
                    {open.version != null && open.version > 1 && (
                      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#475569]">
                        v{open.version}
                      </span>
                    )}
                    {open.is_selected && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#D1FAE5] text-[#047857]">
                        <CheckCircle2 size={10} /> Selected
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
                        onClick={() => {
                          if (open.is_selected) {
                            if (confirm('Unselect this option?')) toggleSelected(open)
                          } else {
                            toggleSelected(open)
                          }
                        }}
                        disabled={busy}
                        title={open.is_selected ? 'Unselect this option' : 'Mark this as the selected proposal'}
                        className={`px-2.5 py-1 text-[12px] font-semibold inline-flex items-center gap-1.5 rounded transition-colors ${open.is_selected ? 'bg-[#D1FAE5] text-[#047857] hover:bg-[#A7F3D0]' : 'bg-white border border-[#cbd5e1] text-[#3E3E3C] hover:bg-[#fafbfc]'}`}
                      >
                        {open.is_selected ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                        {open.is_selected ? 'Selected' : 'Mark as selected'}
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
                    {/* Same "add related" chip + picker pattern used on tasks
                        — single source of UX truth for entity linking. */}
                    {linkedSystems().length === 0 && !editing && (
                      <span className="text-[13px] text-[#A8A8A8] italic">None linked</span>
                    )}
                    {linkedSystems().length > 0 && (
                      <ul className="flex flex-wrap gap-1.5">
                        {linkedSystems().map(s => (
                          <li key={s.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-[#EFF6FF] border border-[#bfdbfe] rounded-full text-[12px]">
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 text-[#1d4ed8]">System</span>
                            <span className="font-medium text-[#1d4ed8]">{s.name}</span>
                            <span className="text-[11px] text-[#3b82f6] opacity-80">· {fmtKwdc(s.size_kwdc ?? 0)}</span>
                            {editing && (
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = editForm.linked_system_ids ?? []
                                  setEditForm(f => ({ ...f, linked_system_ids: cur.filter(x => x !== s.id) }))
                                }}
                                title="Unlink"
                                className="ml-1 p-0.5 hover:bg-[#dbeafe] rounded-full text-[#3b82f6]"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {editing && (
                      <div className="flex items-center gap-2 mt-2">
                        <select
                          value={pendingSystemId}
                          onChange={e => setPendingSystemId(e.target.value)}
                          className="flex-1 px-2 py-1.5 border border-[#cbd5e1] rounded text-[13px] bg-white focus:outline-none focus:border-[#70A0D0]"
                        >
                          <option value="">— Select a system to link —</option>
                          {systems
                            .filter(s => !(editForm.linked_system_ids ?? []).includes(s.id))
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.name} · {fmtKwdc(s.size_kwdc ?? 0)} · {fmtKwh(s.annual_production_kwh ?? 0)}/yr</option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={!pendingSystemId}
                          onClick={() => {
                            const cur = editForm.linked_system_ids ?? []
                            setEditForm(f => ({ ...f, linked_system_ids: [...cur, pendingSystemId] }))
                            setPendingSystemId('')
                          }}
                          className="btn-secondary h-[30px]"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </div>
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
                    <FieldCell label="Quote created" full>
                      {editing
                        ? <DateInput value={editForm.quote_created_at ?? ''} onChange={v => setEditForm(f => ({ ...f, quote_created_at: v || null }))} />
                        : (open.quote_created_at ? formatDate(open.quote_created_at) : '—')}
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
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f1f5f9]">
                    <CalcField label="Total electric bill savings" value={formatCurrency(totalElectricBillSavings())} />
                    <CalcField label="Blended avoided cost" value={blendedAvoidedCost() > 0 ? fmtRate(blendedAvoidedCost()) : '—'} />
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
                  <FieldCell label="Year 1 price">
                    {editing
                      ? <CurrencyInput value={editForm.year1_contract_price ?? 0} decimals={4} suffix="/kWh" onChange={v => setEditForm(f => ({ ...f, year1_contract_price: v }))} />
                      : (open.year1_contract_price != null ? `$${Number(open.year1_contract_price).toFixed(4)}/kWh` : '—')}
                  </FieldCell>
                  <FieldCell label="Escalation rate">
                    {editing
                      ? <NumberInput value={editForm.escalation_rate ?? 0} onChange={v => setEditForm(f => ({ ...f, escalation_rate: v }))} suffix="%" />
                      : (open.escalation_rate != null ? `${open.escalation_rate}%` : '—')}
                  </FieldCell>
                </div>
              </SectionShell>

              {/* ─────────────────── 4. Contract Performance ─────────────────── */}
              <SectionShell title="Contract Performance">
                <div className="px-5 py-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <CalcField
                    label="Year 1 net savings"
                    value={formatCurrency(year1NetSavings())}
                    info="Total Electric Bill Savings − (Year 1 Price × Total Year 1 Production). Displayed in full dollars."
                  />
                  <FieldCell label="Utility escalation">
                    {editing
                      ? <NumberInput value={editForm.utility_escalation_rate ?? 5} onChange={v => setEditForm(f => ({ ...f, utility_escalation_rate: v }))} suffix="%" />
                      : `${open.utility_escalation_rate ?? 5}%`}
                  </FieldCell>
                  <FieldCell label={
                    <InfoLabel
                      label="Customer term savings"
                      info="Enter the value in thousands of dollars. Displayed with a K suffix to confirm units."
                    />
                  }>
                    {editing
                      ? <CurrencyInput value={editForm.customer_term_savings ?? 0} onChange={v => setEditForm(f => ({ ...f, customer_term_savings: v }))} suffix="K" />
                      : (open.customer_term_savings != null ? formatThousandsCurrency(open.customer_term_savings) : '—')}
                  </FieldCell>
                  <FieldCell label={
                    <InfoLabel
                      label="Customer term NPV"
                      info="Enter the value in thousands of dollars. Displayed with a K suffix to confirm units."
                    />
                  }>
                    {editing
                      ? <CurrencyInput value={editForm.customer_term_npv ?? 0} onChange={v => setEditForm(f => ({ ...f, customer_term_npv: v }))} suffix="K" />
                      : (open.customer_term_npv != null ? formatThousandsCurrency(open.customer_term_npv) : '—')}
                  </FieldCell>
                </div>
              </SectionShell>

              {/* ───────────────────── 5. Environmental Attributes ───────────────────── */}
              <SectionShell title="Environmental Attributes">
                <div className="px-5 py-4 grid grid-cols-2 gap-x-5 gap-y-4">
                  <FieldCell label="SREC treatment">
                    {editing
                      ? <SelectInput value={editForm.srec_treatment ?? ''} options={SREC_TREATMENTS} onChange={v => setEditForm(f => ({ ...f, srec_treatment: v }))} />
                      : (open.srec_treatment || '—')}
                  </FieldCell>
                  <CalcField label="Total SRECs" value={totalSRECs() > 0 ? `${Math.round(totalSRECs()).toLocaleString()} SRECs/yr` : '—'} />
                </div>
              </SectionShell>

              {/* Notes — rich text editor with bullets / numbered / bold */}
              <SectionShell title="Notes">
                <div className="px-5 py-4">
                  {editing ? (
                    <RichTextEditor
                      value={editForm.notes ?? ''}
                      onChange={html => setEditForm(f => ({ ...f, notes: html }))}
                    />
                  ) : open.notes ? (
                    <NotesRender source={open.notes} />
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
                            <p className="text-[13px] text-[#181818] mt-0.5 whitespace-pre-wrap">
                              <MessageText text={t.message} users={users} />
                            </p>
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

function SectionShell({ title, rightSlot, children }: { title: React.ReactNode; rightSlot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-[#e2e8f0] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#f1f5f9] bg-[#F3F2F2] flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] font-bold text-[#3E3E3C] uppercase tracking-[0.06em]">{title}</h3>
        {rightSlot}
      </div>
      {children}
    </div>
  )
}

function FieldCell({ label, full, children }: { label: React.ReactNode; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <div className="text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[13px] text-[#181818]">{children}</div>
    </div>
  )
}

function InfoLabel({ label, info }: { label: string; info: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span className="relative group inline-flex items-center cursor-help text-[#94a3b8] hover:text-[#3E3E3C]">
        <Info size={11} />
        {/* Always-on hover tooltip — replaces the unreliable native title attr */}
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-10 hidden group-hover:block w-56 px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-snug text-white bg-[#181818] rounded shadow-lg">
          {info}
          <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#181818]" />
        </span>
      </span>
    </span>
  )
}

// Currency-formatted input: shows $ prefix in a read-only span, user types
// the number. Supports custom decimal precision and an optional suffix.
//
// Important: re-formatting happens ONLY on blur. While focused, we keep the
// text exactly as the user typed it — previously a useEffect re-ran on every
// keystroke, reformatting "8" to "8.00" mid-typing and producing garbled
// values like "8.01" when the user typed "8610".
function CurrencyInput({ value, onChange, decimals = 2, suffix }: { value: number; onChange: (v: number) => void; decimals?: number; suffix?: string }) {
  const [text, setText] = useState<string>(() => formatForEdit(value, decimals))
  const [hasFocus, setHasFocus] = useState(false)

  // Re-sync text from the external value only when the user isn't actively
  // typing. Lets the form be programmatically reset (e.g., when opening a
  // different row) without stomping the user's in-progress typing.
  useEffect(() => {
    if (!hasFocus) setText(formatForEdit(value, decimals))
  }, [value, decimals, hasFocus])

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 flex items-center border border-[#cbd5e1] rounded focus-within:border-[#70A0D0] focus-within:ring-2 focus-within:ring-[#70A0D0]/20 bg-white">
        <span className="px-2 py-1 text-[13px] text-[#706E6B] border-r border-[#e2e8f0]">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={() => setHasFocus(true)}
          onBlur={() => { setHasFocus(false); setText(formatForEdit(value, decimals)) }}
          onChange={e => {
            // Keep the text exactly as typed; only parse to a number for the
            // underlying form state. Strip non-numeric chars (except . and -)
            // before parsing so "$1,234.56" turns into 1234.56.
            setText(e.target.value)
            const raw = e.target.value.replace(/[^0-9.\-]/g, '')
            const n = parseFloat(raw)
            if (Number.isFinite(n)) onChange(n)
            else if (raw === '' || raw === '-') onChange(0)
          }}
          className="flex-1 px-2 py-1 text-[13px] text-[#181818] bg-transparent focus:outline-none"
        />
      </div>
      {suffix && <span className="text-[11px] text-[#706E6B] flex-shrink-0">{suffix}</span>}
    </div>
  )
}

function formatForEdit(n: number, decimals: number): string {
  if (n == null || Number.isNaN(n)) return ''
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// Display a "thousands" value as-entered with a K suffix, leaving the
// units explicit and avoiding silent × 1000 multiplication. Stored as
// "amount in $K" — display matches input.
function formatThousandsCurrency(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v) || v === 0) return '$0K'
  return `${formatCurrency(v)}K`
}

// ── Small inline helpers used by the drawer field grid ────────────────
// (These were accidentally cut during a refactor; restoring.)

function CalcField({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold text-[#706E6B] uppercase tracking-wider mb-1 flex items-center gap-1">
        <span>{label}</span>
        <span className="inline-block px-1 py-0 text-[8.5px] font-semibold bg-[#EFF6FF] text-[#1d4ed8] rounded">CALC</span>
        {info && (
          <span className="relative group inline-flex items-center cursor-help text-[#94a3b8] hover:text-[#3E3E3C] ml-0.5">
            <Info size={11} />
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-10 hidden group-hover:block w-56 px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-snug text-white bg-[#181818] rounded shadow-lg">
              {info}
              <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#181818]" />
            </span>
          </span>
        )}
      </div>
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

