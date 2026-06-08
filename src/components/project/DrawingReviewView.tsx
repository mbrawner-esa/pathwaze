'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { ChevronLeft, FileText, ExternalLink } from 'lucide-react'

const DISPOSITIONS: { value: string; label: string; bg: string; text: string }[] = [
  { value: 'confirmed',    label: 'Confirmed',    bg: '#F0FDF4', text: '#166534' },
  { value: 'field_verify', label: 'Field-Verify', bg: '#EFF6FF', text: '#1d4ed8' },
  { value: 'unknown',      label: 'Unknown',      bg: '#F3F4F6', text: '#475569' },
  { value: 'conflict',     label: 'Conflict',     bg: '#FFF7ED', text: '#9a3412' },
  { value: 'risk',         label: 'Risk',         bg: '#FEF2F2', text: '#b91c1c' },
]
const DISP = Object.fromEntries(DISPOSITIONS.map(d => [d.value, d]))
const STATUSES = ['not_started', 'in_progress', 'under_review', 'complete'] as const
const STATUS_LABEL: Record<string, string> = { not_started: 'Not started', in_progress: 'In Progress', under_review: 'Under Review', complete: 'Complete' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
interface ItemState { disposition: string; finding_text: string; sheet_ref: string; sow_action: string; override: boolean }

export function DrawingReviewView({ drawingId, onBack }: { drawingId: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Any>(null)
  const [items, setItems] = useState<Record<string, ItemState>>({})
  const [status, setStatus] = useState<string>('not_started')

  useEffect(() => {
    let live = true
    ;(async () => {
      setLoading(true); setError(null)
      const res = await fetch(`/api/drawings/${drawingId}/review`)
      if (!res.ok) { const b = await res.json().catch(() => ({})); if (live) { setError(b?.error || 'Failed to load review'); setLoading(false) }; return }
      const d = await res.json()
      if (!live) return
      // Merge findings + shared universal answers into a per-item state map.
      const findingByItem: Record<string, Any> = {}
      for (const f of d.findings) findingByItem[f.action_plan_item_id] = f
      const sharedByItem: Record<string, Any> = {}
      for (const u of d.universal) sharedByItem[u.action_plan_item_id] = u
      const map: Record<string, ItemState> = {}
      for (const sec of d.sections) for (const it of sec.items) {
        const override = findingByItem[it.id]?.is_override
        const src = sec.is_universal
          ? (override ? findingByItem[it.id] : sharedByItem[it.id])
          : findingByItem[it.id]
        map[it.id] = {
          disposition: src?.disposition ?? '',
          finding_text: src?.finding_text ?? '',
          sheet_ref: src?.sheet_ref ?? '',
          sow_action: src?.sow_action ?? '',
          override: !!override,
        }
      }
      setData(d); setItems(map); setStatus(d.review.status); setLoading(false)
    })()
    return () => { live = false }
  }, [drawingId])

  const scopeItems = useMemo(() => (data?.sections ?? []).flatMap((s: Any) => s.items), [data])
  const reviewedCount = Object.values(items).filter(i => i.disposition).length
  const tally = useMemo(() => {
    const t: Record<string, number> = {}
    for (const i of Object.values(items)) if (i.disposition) t[i.disposition] = (t[i.disposition] ?? 0) + 1
    return t
  }, [items])

  function setItem(id: string, patch: Partial<ItemState>) {
    setItems(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function save(itemId: string, isUniversal: boolean) {
    const v = items[itemId]
    await fetch(`/api/drawings/${drawingId}/review/findings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId, is_universal: isUniversal, override: v.override,
        disposition: v.disposition || null, finding_text: v.finding_text || null,
        sheet_ref: v.sheet_ref || null, sow_action: v.sow_action || null,
      }),
    })
    if (status === 'not_started' && v.disposition) setStatus('in_progress')
  }

  async function changeStatus(s: string) {
    setStatus(s)
    await fetch(`/api/drawings/${drawingId}/review`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }),
    })
  }

  async function viewPdf() {
    if (!data?.drawing?.storage_path) { alert('No file attached.'); return }
    const sb = createBrowserClient()
    const { data: signed } = await sb.storage.from('drawings').createSignedUrl(data.drawing.storage_path, 120)
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank')
  }

  if (loading) return <div className="p-8 text-center text-[#706E6B] text-[13px]">Loading review…</div>
  if (error) return (
    <div>
      <button onClick={onBack} className="text-[#70A0D0] font-semibold text-[13px] flex items-center gap-1 mb-3"><ChevronLeft size={14} /> Back</button>
      <div className="card p-6 text-center text-[#b91c1c] text-[13px]">{error}</div>
    </div>
  )

  const d = data.drawing
  const disciplineLabel = (data.sections.find((s: Any) => !s.is_universal)?.label) ?? null

  return (
    <div>
      {/* header */}
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <button onClick={onBack} className="text-[#70A0D0] font-semibold text-[12.5px] flex items-center gap-1 mb-1.5"><ChevronLeft size={14} /> Back to {d.collection?.name ?? 'drawings'}</button>
          <div className="text-[12px] text-[#706E6B]">{d.area?.name}{d.area ? ' · ' + d.area.category : ''}{disciplineLabel ? ' › ' + disciplineLabel : ''}</div>
          <div className="text-[18px] font-bold text-[#080707] flex items-center gap-2 mt-0.5">
            <FileText size={18} className="text-[#b91c1c]" /> {d.file_name}
          </div>
        </div>
        <button className="btn-secondary" onClick={viewPdf}><ExternalLink size={13} /> View PDF</button>
      </div>

      {/* status chevrons */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => changeStatus(s)}
            className={'text-[11px] font-semibold px-3 py-1.5 rounded-md ' + (status === s ? 'bg-[#FFFBEB] text-[#92400e] ring-1 ring-[#FCD9A0]' : 'bg-[#F3F2F2] text-[#706E6B] hover:bg-[#ECEBEA]')}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* progress */}
      <div className="card px-4 py-3 mb-4">
        <div className="flex justify-between items-center mb-2">
          <b className="text-[13.5px] text-[#080707]">Review progress</b>
          <span className="text-[12px] text-[#706E6B]">{reviewedCount} of {scopeItems.length} items reviewed · {scopeItems.length ? Math.round((reviewedCount / scopeItems.length) * 100) : 0}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#F3F2F2] overflow-hidden"><div className="h-full bg-[#70A0D0]" style={{ width: `${scopeItems.length ? (reviewedCount / scopeItems.length) * 100 : 0}%` }} /></div>
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {DISPOSITIONS.map(dz => (
            <span key={dz.value} className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: dz.bg, color: dz.text }}>
              {tally[dz.value] ?? 0} {dz.label}
            </span>
          ))}
        </div>
      </div>

      {/* sections */}
      {(data.sections as Any[]).sort((a, b) => Number(b.is_universal) - Number(a.is_universal)).map(sec => (
        <div key={sec.id} className="card mb-3 overflow-hidden">
          <div className="px-[18px] py-3 border-b border-[#ECEBEA] bg-[#FBFCFE] flex items-center gap-2">
            <span className="font-bold text-[#080707] text-[14px]">{sec.label}</span>
            <span className="text-[11px] text-[#706E6B] bg-[#F3F2F2] rounded-full px-2 py-0.5">{sec.items.length} items</span>
            {sec.is_universal && <span className="text-[9.5px] font-bold text-[#2C5485] bg-[#EFF4FA] border border-[#cfe0ef] rounded px-1.5 py-0.5">🔗 synced across set</span>}
          </div>
          {sec.is_universal && (
            <div className="px-[18px] py-2 text-[11.5px] text-[#2C5485] bg-[#F4F8FC] border-b border-[#e3eef7]">
              Shared across this set ({d.collection?.name}, {d.area?.name}). Answers sync to sibling drawings — toggle <b>Override</b> to set one just for this drawing.
            </div>
          )}
          {sec.items.map((it: Any) => {
            const v = items[it.id]
            return (
              <div key={it.id} className="px-[18px] py-3 border-b border-[#ECEBEA] last:border-b-0">
                <div className="flex items-start gap-3">
                  <div className="flex-1 text-[13px] text-[#181818] leading-snug">
                    {it.prompt}
                    {it.reviewer_hint && <span className="ml-2 text-[10px] font-bold text-[#2C5485] bg-[#EFF4FA] border border-[#cfe0ef] rounded px-1.5 py-0.5">⚙ engineer follow-up likely</span>}
                    {sec.is_universal && v.override && <span className="ml-2 text-[10px] font-bold text-[#92400e] bg-[#FFFBEB] border border-[#FCD9A0] rounded px-1.5 py-0.5">✎ overridden</span>}
                    {it.hunting_for && <div className="text-[11px] text-[#706E6B] mt-1 italic">{it.hunting_for}</div>}
                  </div>
                  <select value={v.disposition}
                    onChange={e => { setItem(it.id, { disposition: e.target.value }); setTimeout(() => save(it.id, sec.is_universal), 0) }}
                    className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px] font-semibold"
                    style={v.disposition ? { background: DISP[v.disposition].bg, color: DISP[v.disposition].text } : {}}>
                    <option value="">—</option>
                    {DISPOSITIONS.map(dz => <option key={dz.value} value={dz.value}>{dz.label}</option>)}
                  </select>
                </div>
                {v.disposition && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <textarea value={v.finding_text} onChange={e => setItem(it.id, { finding_text: e.target.value })} onBlur={() => save(it.id, sec.is_universal)}
                      placeholder="Finding — what the drawing does / doesn't confirm…"
                      className="border border-[#DDDBDA] rounded-md px-2.5 py-2 text-[12.5px] min-h-[40px]" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#706E6B]">Sheet / detail</span>
                      <input value={v.sheet_ref} onChange={e => setItem(it.id, { sheet_ref: e.target.value })} onBlur={() => save(it.id, sec.is_universal)}
                        placeholder="e.g. E-201" className="border border-[#DDDBDA] rounded-md px-2 py-1 text-[12px] w-[160px]" />
                      {sec.is_universal && (
                        <label className="ml-auto flex items-center gap-1.5 text-[11.5px] text-[#706E6B] cursor-pointer">
                          <input type="checkbox" checked={v.override}
                            onChange={e => { setItem(it.id, { override: e.target.checked }); setTimeout(() => save(it.id, sec.is_universal), 0) }} />
                          Override for this drawing
                        </label>
                      )}
                    </div>
                    {v.disposition !== 'confirmed' && (
                      <div className="border-l-[3px] border-[#70A0D0] bg-[#F7FAFC] rounded-r-md px-3 py-2">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-[#706E6B] mb-1">Survey SOW action</div>
                        <textarea value={v.sow_action} onChange={e => setItem(it.id, { sow_action: e.target.value })} onBlur={() => save(it.id, sec.is_universal)}
                          placeholder="What goes on the on-site survey scope…"
                          className="w-full bg-white border border-[#DDDBDA] rounded-md px-2.5 py-2 text-[12.5px] min-h-[36px]" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button className="text-[11.5px] font-semibold text-[#3E3E3C] border border-[#DDDBDA] rounded-md px-2.5 py-1.5 hover:bg-[#F3F2F2]"
                        onClick={() => alert('Delegate → engineer task (P4).')}>Delegate ▸</button>
                      <button className="text-[11.5px] font-bold text-[#0f766e] border border-[#99f6e4] rounded-md px-2.5 py-1.5 hover:bg-[#f0fdfa]"
                        onClick={() => alert('Create RFI (P5).')}>Create RFI ▸</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
