'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, Pencil, Paperclip, X } from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/Avatar'
import { RichTextEditor } from '@/components/ui/RichTextEditor'
import { NotesRender } from '@/components/ui/NotesRender'
import { ReceivedFromPicker } from './ReceivedFromPicker'

type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

const ballName = (r: Any) => r.ball_user?.full_name || r.ball_sh?.name || '—'
const isOverdue = (r: Any) => r.status === 'open' && !!r.due_date && new Date(r.due_date) < new Date()
const rfiNo = (n: number) => '#' + String(n ?? 0).padStart(3, '0')
const plainText = (html: string) => (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()

const LINK_TYPES: { key: string; label: string }[] = [
  { key: 'building', label: 'Area' }, { key: 'system', label: 'System' }, { key: 'meter', label: 'Meter' },
  { key: 'stakeholder', label: 'Stakeholder' }, { key: 'drawing', label: 'Drawing' },
]
function entityLabel(catalog: Any, type: string, idv: string): string {
  const e = (catalog[type] ?? []).find((x: Any) => x.id === idv)
  if (!e) return '(unknown)'
  if (type === 'meter') return e.meter_num || e.account_num || e.account_number || 'Meter'
  if (type === 'system') return e.label || e.name || 'System'
  if (type === 'drawing') return e.file_name
  return e.name || '(unnamed)'
}

export function RfiDetailClient({ rfi: initial, responses: initialResp, links: initialLinks, catalog, users, attachments: initialAttachments = [] }: { rfi: Any; responses: Any[]; distribution: Any[]; users: Any[]; links: Any[]; catalog: Any; attachments?: Any[] }) {
  const router = useRouter()
  const [rfi, setRfi] = useState<Any>(initial)
  const [responses, setResponses] = useState<Any[]>(initialResp)
  const [links, setLinks] = useState<Any[]>(initialLinks)
  const [attachments, setAttachments] = useState<Any[]>(initialAttachments)
  const [uploadingAtt, setUploadingAtt] = useState(false)
  const [linkType, setLinkType] = useState('building')
  const [linkEntity, setLinkEntity] = useState('')
  const [draft, setDraft] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(true)
  const [editing, setEditing] = useState(false)

  async function addLink() {
    if (!linkEntity) return
    const res = await fetch(`/api/rfis/${rfi.id}/links`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity_type: linkType, entity_id: linkEntity }) })
    if (res.ok) { const row = await res.json(); setLinks(prev => [...prev, row]); setLinkEntity('') }
  }
  async function removeLink(linkId: string) {
    if ((await fetch(`/api/rfis/${rfi.id}/links/${linkId}`, { method: 'DELETE' })).ok) setLinks(prev => prev.filter(l => l.id !== linkId))
  }

  async function patch(body: Any) {
    setBusy(true)
    const res = await fetch(`/api/rfis/${rfi.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(false)
    if (res.ok) { setRfi({ ...rfi, ...(await res.json()) }); router.refresh() }
  }

  async function addResponse(official: boolean, close: boolean) {
    if (!plainText(draft) && pendingFiles.length === 0) return
    setBusy(true)
    // Upload any staged files to storage first.
    const sb = createBrowserClient()
    const fileMeta: Any[] = []
    for (const file of pendingFiles) {
      const safe = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${rfi.id}/${Date.now()}-${safe}`
      const { error: upErr } = await sb.storage.from('rfi-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
      if (!upErr) fileMeta.push({ file_name: file.name, storage_path: path, file_size: file.size, content_type: file.type })
    }
    const res = await fetch(`/api/rfis/${rfi.id}/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: draft, is_official: official, close, files: fileMeta }) })
    setBusy(false)
    if (res.ok) {
      const created = await res.json()
      setResponses(prev => [...prev, created])
      setDraft(''); setPendingFiles([])
      if (official) setRfi({ ...rfi, status: close ? 'closed' : rfi.status })
      router.refresh()
    }
  }

  async function openFile(f: Any) {
    if (!f.storage_path) return
    const w = window.open('', '_blank')
    const sb = createBrowserClient()
    const { data: signed } = await sb.storage.from('rfi-files').createSignedUrl(f.storage_path, 120)
    if (signed?.signedUrl && w) w.location.href = signed.signedUrl
    else w?.close()
  }

  // RFI-level attachments (distinct from response attachments).
  async function uploadAttachments(fileList: File[]) {
    if (!fileList.length) return
    setUploadingAtt(true)
    const sb = createBrowserClient()
    const fileMeta: Any[] = []
    for (const file of fileList) {
      const safe = file.name.replace(/[^\w.\-]+/g, '_')
      const path = `${rfi.id}/att-${Date.now()}-${safe}`
      const { error: upErr } = await sb.storage.from('rfi-files').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
      if (!upErr) fileMeta.push({ file_name: file.name, storage_path: path, file_size: file.size, content_type: file.type })
    }
    if (fileMeta.length) {
      const res = await fetch(`/api/rfis/${rfi.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: fileMeta }) })
      if (res.ok) { const rows = await res.json(); setAttachments(prev => [...prev, ...rows]) }
    }
    setUploadingAtt(false)
  }
  async function removeAttachment(fileId: string) {
    setAttachments(prev => prev.filter(f => f.id !== fileId))   // optimistic
    await fetch(`/api/rfis/${rfi.id}/files/${fileId}`, { method: 'DELETE' })
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
              <span className="text-[13px] font-extrabold text-[#2C5485]">RFI {rfiNo(rfi.rfi_number)}</span>
              <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full" style={overdue ? { background: '#FEF2F2', color: '#b91c1c' } : rfi.status === 'closed' ? { background: '#F0FDF4', color: '#166534' } : { background: '#EFF6FF', color: '#1d4ed8' }}>
                {overdue ? 'Overdue' : rfi.status === 'closed' ? 'Closed' : rfi.status === 'draft' ? 'Draft' : 'Open'}
              </span>
              <span className="text-[12px] text-[#706E6B]">· </span>
              <Link href={`/projects/${rfi.project_id}`} className="text-[12px] font-semibold text-[#2C5485] hover:underline">{rfi.project?.name}</Link>
              <button className="btn-secondary ml-auto" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
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
            <div className="px-[18px] py-3 border-b border-[#ECEBEA] flex items-center justify-between">
              <span className="font-bold text-[13px] text-[#080707]">Attachments <span className="text-[#706E6B] font-medium text-[11px]">{attachments.length}</span></span>
              <label className="btn-secondary cursor-pointer text-[12px]"><Paperclip size={13} /> {uploadingAtt ? 'Uploading…' : 'Attach'}
                <input type="file" multiple className="hidden" disabled={uploadingAtt}
                  onChange={e => { if (e.target.files) uploadAttachments(Array.from(e.target.files)); e.target.value = '' }} />
              </label>
            </div>
            {attachments.length === 0
              ? <div className="px-[18px] py-3 text-[12px] text-[#A8A8A8]">No files attached to this RFI.</div>
              : <div className="px-[18px] py-3 flex flex-wrap gap-2">
                  {attachments.map((f: Any) => (
                    <span key={f.id} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#2C5485] bg-[#EFF4FA] border border-[#cfe0ef] rounded-md pl-2 pr-1 py-1">
                      <button onClick={() => openFile(f)} className="inline-flex items-center gap-1.5"><Paperclip size={12} /> {f.file_name}</button>
                      <button onClick={() => removeAttachment(f.id)} className="p-0.5 text-[#A8A8A8] hover:text-[#b91c1c]" title="Remove"><X size={11} /></button>
                    </span>
                  ))}
                </div>
            }
          </div>

          <div className="card overflow-hidden">
            <div className="px-[18px] py-3 border-b border-[#ECEBEA] font-bold text-[13px] text-[#080707]">Responses <span className="text-[#706E6B] font-medium text-[11px]">{responses.length}</span></div>
            {responses.length === 0 && <div className="px-[18px] py-4 text-[12.5px] text-[#A8A8A8]">No responses yet.</div>}
            {responses.map(r => (
              <div key={r.id} className="px-[18px] py-3.5 border-b border-[#ECEBEA] last:border-b-0 flex gap-3">
                <Avatar name={r.author?.full_name ?? r.author_name ?? 'External'} imageUrl={r.author?.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px]"><b className="text-[#181818]">{r.author?.full_name ?? r.author_name ?? 'External'}</b>
                    <span className="text-[#A8A8A8] ml-2">{new Date(r.created_at).toLocaleString()}{r.via === 'email' ? ' · via email' : ''}</span>
                    {r.is_official && <span className="ml-2 text-[9.5px] font-extrabold uppercase text-[#166534] bg-[#F0FDF4] border border-[#bbf7d0] rounded px-1.5 py-0.5">Official</span>}
                  </div>
                  <div className="text-[12.5px] text-[#3E3E3C] leading-relaxed mt-1"><NotesRender source={r.body || ''} /></div>
                  {(r.files ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.files.map((f: Any) => (
                        <button key={f.id} onClick={() => openFile(f)} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#2C5485] bg-[#EFF4FA] border border-[#cfe0ef] rounded-md px-2 py-1">
                          <Paperclip size={12} /> {f.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {rfi.status !== 'closed' && (
              <div className="px-[18px] py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE]">
                <RichTextEditor value={draft} onChange={setDraft} placeholder="Add a response… use @ to mention someone" minHeight={70} mentionUsers={users} />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pendingFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#3E3E3C] bg-[#F3F2F2] rounded-md px-2 py-1">
                        <Paperclip size={12} /> {f.name}
                        <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-[#A8A8A8] hover:text-[#b91c1c]"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-between items-center gap-2 mt-2">
                  <label className="btn-secondary cursor-pointer"><Paperclip size={13} /> Attach
                    <input type="file" multiple className="hidden" onChange={e => { if (e.target.files) setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} />
                  </label>
                  <div className="flex gap-2">
                    <button className="btn-secondary" disabled={busy || (!plainText(draft) && !pendingFiles.length)} onClick={() => addResponse(false, false)}>Add Response</button>
                    <button className="btn-primary" disabled={busy || (!plainText(draft) && !pendingFiles.length)} onClick={() => addResponse(true, true)}>Mark Official &amp; Close</button>
                  </div>
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
            <button onClick={() => setDetailsOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 font-bold text-[12px] text-[#080707] hover:bg-[#FBFCFE]">
              <span>Details</span>
              <ChevronDown size={14} className={'transition-transform ' + (detailsOpen ? 'rotate-180' : '')} />
            </button>
            {detailsOpen && [
              ['Status', overdue ? 'Open · Overdue' : (rfi.status?.[0]?.toUpperCase() + rfi.status?.slice(1))],
              ['Ball in Court', ballName(rfi)],
              ['RFI Manager', rfi.manager?.full_name ?? '—'],
              ['Received From', rfi.received_user?.full_name || rfi.received_sh?.name || rfi.received_from || '—'],
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

          <div className="card overflow-hidden">
            <button onClick={() => setLinksOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 font-bold text-[12px] text-[#080707] hover:bg-[#FBFCFE]">
              <span>Linkages <span className="text-[#706E6B] font-medium">{links.length}</span></span>
              <ChevronDown size={14} className={'transition-transform ' + (linksOpen ? 'rotate-180' : '')} />
            </button>
            {linksOpen && <div className="p-4 pt-0 flex flex-col gap-2 border-t border-[#ECEBEA]">
              {links.length === 0 && <div className="text-[12px] text-[#A8A8A8] pt-3">No linked records yet.</div>}
              {links.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#706E6B] w-[74px] shrink-0">{LINK_TYPES.find(t => t.key === l.entity_type)?.label ?? l.entity_type}</span>
                  <span className="flex-1 text-[#181818] font-semibold truncate">{entityLabel(catalog, l.entity_type, l.entity_id)}</span>
                  <button onClick={() => removeLink(l.id)} className="text-[#A8A8A8] hover:text-[#b91c1c] text-[15px] leading-none">×</button>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#ECEBEA]">
                <select value={linkType} onChange={e => { setLinkType(e.target.value); setLinkEntity('') }} className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px]">
                  {LINK_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <select value={linkEntity} onChange={e => setLinkEntity(e.target.value)} className="flex-1 min-w-0 border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px]">
                  <option value="">Select…</option>
                  {(catalog[linkType] ?? []).map((e: Any) => <option key={e.id} value={e.id}>{entityLabel(catalog, linkType, e.id)}</option>)}
                </select>
                <button className="btn-secondary" disabled={!linkEntity} onClick={addLink}>Add</button>
              </div>
            </div>}
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

      {editing && (
        <EditRfiModal rfi={rfi} users={users} stakeholders={catalog.stakeholder ?? []} onClose={() => setEditing(false)}
          onSave={async body => { await patch(body); setEditing(false) }} />
      )}
    </div>
  )
}

// ── Edit RFI modal ──────────────────────────────────────────────────────
function EditRfiModal({ rfi, users, stakeholders: initialStakeholders, onClose, onSave }: { rfi: Any; users: Any[]; stakeholders: Any[]; onClose: () => void; onSave: (body: Any) => Promise<void> }) {
  const [stakeholders, setStakeholders] = useState<Any[]>(initialStakeholders)
  const [f, setF] = useState<Any>({
    subject: rfi.subject ?? '', question: rfi.question ?? '',
    received_from_user_id: rfi.received_from_user_id ?? '', received_from_stakeholder_id: rfi.received_from_stakeholder_id ?? '',
    ball_in_court_user_id: rfi.ball_in_court_user_id ?? '', rfi_manager_id: rfi.rfi_manager_id ?? '',
    due_date: rfi.due_date ?? '', drawing_number: rfi.drawing_number ?? '', spec_section: rfi.spec_section ?? '',
    location: rfi.location ?? '', cost_impact: rfi.cost_impact ?? 'tbd', schedule_impact: rfi.schedule_impact ?? 'tbd',
    priority: rfi.priority ?? 'normal',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: Any) => setF((p: Any) => ({ ...p, [k]: v }))

  async function save() {
    setSaving(true)
    await onSave({
      ...f,
      ball_in_court_user_id: f.ball_in_court_user_id || null,
      rfi_manager_id: f.rfi_manager_id || null,
      received_from_user_id: f.received_from_user_id || null,
      received_from_stakeholder_id: f.received_from_stakeholder_id || null,
      due_date: f.due_date || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-[580px] max-w-[94vw] max-h-[90vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-[#ECEBEA] font-bold text-[15px] text-[#080707]">Edit RFI #{String(rfi.rfi_number ?? 0).padStart(3, '0')}</div>
        <div className="p-5 flex flex-col gap-3">
          <Lbl t="Subject"><input value={f.subject} onChange={e => set('subject', e.target.value)} className="einp" /></Lbl>
          <Lbl t="Question"><textarea value={f.question} onChange={e => set('question', e.target.value)} className="einp min-h-[70px]" /></Lbl>
          <Lbl t="Received from"><ReceivedFromPicker users={users} stakeholders={stakeholders} projectId={rfi.project_id}
            userId={f.received_from_user_id} stakeholderId={f.received_from_stakeholder_id}
            onChange={(u, s) => setF((p: Any) => ({ ...p, received_from_user_id: u ?? '', received_from_stakeholder_id: s ?? '' }))}
            onStakeholderCreated={s => setStakeholders(prev => [...prev, s])} /></Lbl>
          <div className="grid grid-cols-2 gap-3">
            <Lbl t="Ball in Court (internal)"><select value={f.ball_in_court_user_id} onChange={e => set('ball_in_court_user_id', e.target.value)} className="einp"><option value="">—</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Lbl>
            <Lbl t="RFI Manager"><select value={f.rfi_manager_id} onChange={e => set('rfi_manager_id', e.target.value)} className="einp"><option value="">—</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Lbl>
            <Lbl t="Due date"><input type="date" value={f.due_date} onChange={e => set('due_date', e.target.value)} className="einp" /></Lbl>
            <Lbl t="Priority"><select value={f.priority} onChange={e => set('priority', e.target.value)} className="einp"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></Lbl>
            <Lbl t="Drawing number"><input value={f.drawing_number} onChange={e => set('drawing_number', e.target.value)} className="einp" /></Lbl>
            <Lbl t="Spec section"><input value={f.spec_section} onChange={e => set('spec_section', e.target.value)} className="einp" /></Lbl>
            <Lbl t="Location"><input value={f.location} onChange={e => set('location', e.target.value)} className="einp" /></Lbl>
            <div />
            <Lbl t="Cost impact"><select value={f.cost_impact} onChange={e => set('cost_impact', e.target.value)} className="einp"><option value="tbd">TBD</option><option value="yes">Yes</option><option value="no">No</option></select></Lbl>
            <Lbl t="Schedule impact"><select value={f.schedule_impact} onChange={e => set('schedule_impact', e.target.value)} className="einp"><option value="tbd">TBD</option><option value="yes">Yes</option><option value="no">No</option></select></Lbl>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE] flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving || !f.subject.trim()} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <style jsx>{`.einp{border:1px solid #DDDBDA;border-radius:7px;padding:7px 9px;font-size:13px;width:100%;font-family:inherit}`}</style>
    </div>
  )
}

function Lbl({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-[10.5px] font-bold uppercase tracking-wide text-[#706E6B]">{t}</span>{children}</label>
}
