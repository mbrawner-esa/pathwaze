'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

const ballName = (r: Any) => r.ball_user?.full_name || r.ball_sh?.name || '—'
const isOverdue = (r: Any) => r.status === 'open' && !!r.due_date && new Date(r.due_date) < new Date()

export function RfiDetailClient({ rfi: initial, responses: initialResp }: { rfi: Any; responses: Any[]; distribution: Any[]; users: Any[] }) {
  const router = useRouter()
  const [rfi, setRfi] = useState<Any>(initial)
  const [responses, setResponses] = useState<Any[]>(initialResp)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function patch(body: Any) {
    setBusy(true)
    const res = await fetch(`/api/rfis/${rfi.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(false)
    if (res.ok) { setRfi({ ...rfi, ...(await res.json()) }); router.refresh() }
  }

  async function addResponse(official: boolean, close: boolean) {
    if (!draft.trim()) return
    setBusy(true)
    const res = await fetch(`/api/rfis/${rfi.id}/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft, is_official: official, close }) })
    setBusy(false)
    if (res.ok) {
      const created = await res.json()
      setResponses(prev => [...prev, created])
      setDraft('')
      if (official) setRfi({ ...rfi, status: close ? 'closed' : rfi.status })
      router.refresh()
    }
  }

  const overdue = isOverdue(rfi)
  const official = responses.find(r => r.is_official)

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-6">
      <Link href="/rfis" className="text-[#70A0D0] font-semibold text-[12.5px] flex items-center gap-1 mb-3"><ChevronLeft size={14} /> RFIs</Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* MAIN */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-extrabold text-[#2C5485]">RFI #{rfi.rfi_number}</span>
              <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full" style={overdue ? { background: '#FEF2F2', color: '#b91c1c' } : rfi.status === 'closed' ? { background: '#F0FDF4', color: '#166534' } : { background: '#EFF6FF', color: '#1d4ed8' }}>
                {overdue ? 'Overdue' : rfi.status === 'closed' ? 'Closed' : rfi.status === 'draft' ? 'Draft' : 'Open'}
              </span>
              <span className="text-[12px] text-[#706E6B]">· {rfi.project?.name}</span>
            </div>
            <h1 className="text-[20px] font-extrabold text-[#080707] mt-2">{rfi.subject}</h1>
            {rfi.status !== 'closed' && (
              <div className="mt-3 flex items-center gap-2 bg-[#FEF7F0] border border-[#f6d9bf] rounded-lg px-3 py-2">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[#9a3412]">Ball in Court</span>
                <span className="text-[13px] font-bold text-[#181818]">{ballName(rfi)}</span>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-[18px] py-3 border-b border-[#ECEBEA] font-bold text-[13px] text-[#080707]">Question</div>
            <div className="p-[18px] text-[13.5px] text-[#181818] leading-relaxed whitespace-pre-wrap">{rfi.question || <span className="text-[#A8A8A8]">No question text.</span>}</div>
            {(rfi.drawing || rfi.drawing_number) && (
              <div className="px-[18px] pb-[14px] text-[11.5px] text-[#706E6B]">
                Reference: {rfi.drawing?.file_name ?? ''}{rfi.drawing_number ? ` · ${rfi.drawing_number}` : ''}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-[18px] py-3 border-b border-[#ECEBEA] font-bold text-[13px] text-[#080707]">Responses <span className="text-[#706E6B] font-medium text-[11px]">{responses.length}</span></div>
            {responses.length === 0 && <div className="px-[18px] py-4 text-[12.5px] text-[#A8A8A8]">No responses yet.</div>}
            {responses.map(r => (
              <div key={r.id} className="px-[18px] py-3.5 border-b border-[#ECEBEA] last:border-b-0">
                <div className="text-[12.5px]"><b className="text-[#181818]">{r.author?.full_name ?? r.author_name ?? 'External'}</b>
                  <span className="text-[#A8A8A8] ml-2">{new Date(r.created_at).toLocaleString()}{r.via === 'email' ? ' · via email' : ''}</span>
                  {r.is_official && <span className="ml-2 text-[9.5px] font-extrabold uppercase text-[#166534] bg-[#F0FDF4] border border-[#bbf7d0] rounded px-1.5 py-0.5">Official</span>}
                </div>
                <div className="text-[12.5px] text-[#3E3E3C] leading-relaxed mt-1 whitespace-pre-wrap">{r.body}</div>
              </div>
            ))}
            {rfi.status !== 'closed' && (
              <div className="px-[18px] py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE]">
                <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a response…" className="w-full border border-[#DDDBDA] rounded-md px-2.5 py-2 text-[12.5px] min-h-[60px]" />
                <div className="flex justify-end gap-2 mt-2">
                  <button className="btn-secondary" disabled={busy || !draft.trim()} onClick={() => addResponse(false, false)}>Add Response</button>
                  <button className="btn-primary" disabled={busy || !draft.trim()} onClick={() => addResponse(true, true)}>Mark Official &amp; Close</button>
                </div>
              </div>
            )}
            {official && rfi.status === 'closed' && (
              <div className="px-[18px] py-3 bg-[#F0FDF4] border-t border-[#bbf7d0] text-[12px] text-[#14532d]"><b>Closed</b> with official response.</div>
            )}
          </div>
        </div>

        {/* SIDE */}
        <div className="flex flex-col gap-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#ECEBEA] font-bold text-[12px] text-[#080707]">Details</div>
            {[
              ['Status', overdue ? 'Open · Overdue' : (rfi.status?.[0]?.toUpperCase() + rfi.status?.slice(1))],
              ['Ball in Court', ballName(rfi)],
              ['RFI Manager', rfi.manager?.full_name ?? '—'],
              ['Received From', rfi.received_from ?? '—'],
              ['Date Initiated', rfi.date_initiated ?? '—'],
              ['Due Date', rfi.due_date ?? '—'],
              ['Drawing Number', rfi.drawing_number ?? '—'],
              ['Spec Section', rfi.spec_section ?? '—'],
              ['Location', rfi.location ?? (rfi.area?.name ?? '—')],
              ['Cost Impact', rfi.cost_impact ?? 'tbd'],
              ['Schedule Impact', rfi.schedule_impact ?? 'tbd'],
            ].map(([k, v]) => (
              <div key={k as string} className="px-4 py-2.5 border-b border-[#ECEBEA] last:border-b-0">
                <div className="text-[10px] uppercase tracking-wide text-[#706E6B] font-bold">{k}</div>
                <div className="text-[12.5px] text-[#181818] font-semibold mt-0.5" style={(k === 'Cost Impact' && v === 'yes') || (k === 'Due Date' && overdue) ? { color: '#b91c1c' } : {}}>{v as string}</div>
              </div>
            ))}
          </div>

          {rfi.drawing && (
            <div className="rounded-xl bg-[#EFF4FA] border border-[#cfe0ef] p-4">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-[#2C5485]">↩ Created from a finding</div>
              <div className="text-[12.5px] text-[#181818] font-bold mt-1.5">{rfi.drawing.file_name}</div>
              {rfi.area && <div className="text-[11.5px] text-[#706E6B]">{rfi.area.name}</div>}
              <Link href={`/projects/${rfi.project_id}?tab=drawings`} className="text-[#2C5485] text-[11.5px] font-bold mt-2 inline-block">Open the project drawings →</Link>
            </div>
          )}

          {rfi.status === 'draft' && (
            <button className="btn-primary justify-center" disabled={busy} onClick={() => patch({ status: 'open' })}>Send RFI (open)</button>
          )}
          {rfi.status === 'open' && (
            <button className="btn-secondary justify-center" disabled={busy} onClick={() => patch({ status: 'closed' })}>Close RFI</button>
          )}
        </div>
      </div>
    </div>
  )
}
