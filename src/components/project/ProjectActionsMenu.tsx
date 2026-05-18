'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Slack, Copy, Archive, Trash2, X } from 'lucide-react'

interface Props {
  projectId: string
  projectName: string
  slackChannelId: string | null
  archivedAt: string | null
  userRole: 'admin' | 'team' | 'investor' | string
}

type ModalKind = 'rename' | 'slack' | 'duplicate' | 'archive' | 'unarchive' | 'delete' | null

export function ProjectActionsMenu({ projectId, projectName, slackChannelId, archivedAt, userRole }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const isArchived = !!archivedAt
  const isAdmin = userRole === 'admin'

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button onClick={() => setOpen(o => !o)} title="Project actions"
          className="p-1.5 rounded text-[#706E6B] hover:text-[#181818] hover:bg-[#f1f5f9] transition-colors">
          <MoreHorizontal size={16} />
        </button>
        {open && (
          <div className="absolute right-0 top-9 z-50 bg-white rounded-lg shadow-xl border border-[#e2e8f0] py-1 w-56">
            <MenuItem icon={<Pencil size={13} />} onClick={() => { setOpen(false); setModal('rename') }}>
              Rename project
            </MenuItem>
            <MenuItem icon={<Slack size={13} />} onClick={() => { setOpen(false); setModal('slack') }}>
              Sync Slack channel
            </MenuItem>
            <MenuItem icon={<Copy size={13} />} onClick={() => { setOpen(false); setModal('duplicate') }}>
              Duplicate project
            </MenuItem>
            <div className="my-1 border-t border-[#f1f5f9]" />
            {!isArchived ? (
              <MenuItem icon={<Archive size={13} />} onClick={() => { setOpen(false); setModal('archive') }}>
                Archive project
              </MenuItem>
            ) : (
              <MenuItem icon={<Archive size={13} />} onClick={() => { setOpen(false); setModal('unarchive') }}>
                Unarchive project
              </MenuItem>
            )}
            {isAdmin && (
              <MenuItem icon={<Trash2 size={13} />} onClick={() => { setOpen(false); setModal('delete') }} danger>
                Delete project
              </MenuItem>
            )}
          </div>
        )}
      </div>

      {modal === 'rename' && <RenameModal projectId={projectId} initialName={projectName} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh() }} />}
      {modal === 'slack' && <SlackChannelModal projectId={projectId} currentChannelId={slackChannelId} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh() }} />}
      {modal === 'duplicate' && <DuplicateModal projectId={projectId} projectName={projectName} onClose={() => setModal(null)} />}
      {modal === 'archive' && <ConfirmModal title="Archive project?" body={`"${projectName}" will be hidden from the active project list. You can unarchive at any time.`} confirmLabel="Archive" onClose={() => setModal(null)} onConfirm={async () => {
        await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived_at: new Date().toISOString() }) })
        setModal(null)
        router.push('/projects')
      }} />}
      {modal === 'unarchive' && <ConfirmModal title="Unarchive project?" body={`"${projectName}" will return to the active project list.`} confirmLabel="Unarchive" onClose={() => setModal(null)} onConfirm={async () => {
        await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived_at: null }) })
        setModal(null); router.refresh()
      }} />}
      {modal === 'delete' && <ConfirmModal title="Delete project?" body={`"${projectName}" and all its tasks, areas, meters, systems, permits, stakeholders, and documents will be permanently deleted. This cannot be undone.`} confirmLabel="Yes I'm sure — delete" danger onClose={() => setModal(null)} onConfirm={async () => {
        const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
        if (res.ok) { setModal(null); router.push('/projects') }
        else { const b = await res.json().catch(() => ({})); alert(b?.error || 'Delete failed') }
      }} />}
    </>
  )
}

function MenuItem({ children, onClick, icon, danger }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-left transition-colors ${danger ? 'text-[#dc2626] hover:bg-[#fef2f2]' : 'text-[#181818] hover:bg-[#f8fafc]'}`}>
      <span className="text-[#94a3b8]">{icon}</span>
      {children}
    </button>
  )
}

// ─── Modals ──────────────────────────────────────────────────────────
function ModalShell({ title, children, onClose, footer }: { title: string; children: React.ReactNode; onClose: () => void; footer?: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/30 z-40" />
      <div className="fixed left-1/2 top-[18vh] -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl w-full max-w-[440px] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
          <h3 className="text-[14.5px] font-bold text-[#181818]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f1f5f9] text-[#706E6B]"><X size={14} /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3.5 bg-[#fafbfc] border-t border-[#f1f5f9]">{footer}</div>}
      </div>
    </>
  )
}

function RenameModal({ projectId, initialName, onClose, onDone }: { projectId: string; initialName: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function save() {
    if (!name.trim()) { setErr('Name required'); return }
    setSaving(true); setErr(null)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    if (res.ok) onDone()
    else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed'); setSaving(false) }
  }
  return (
    <ModalShell title="Rename project" onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>}>
      <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">Project name</label>
      <input value={name} onChange={e => setName(e.target.value)} autoFocus
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20" />
      {err && <div className="mt-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
    </ModalShell>
  )
}

function SlackChannelModal({ projectId, currentChannelId, onClose, onDone }: { projectId: string; currentChannelId: string | null; onClose: () => void; onDone: () => void }) {
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])
  const [selected, setSelected] = useState<string>(currentChannelId ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/slack/channels').then(r => r.json()).then(d => setChannels(d.channels || [])).catch(() => {})
  }, [])

  async function save() {
    setSaving(true); setErr(null)
    const res = await fetch(`/api/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slack_channel_id: selected || null }) })
    if (res.ok) onDone()
    else { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Save failed'); setSaving(false) }
  }
  return (
    <ModalShell title="Sync Slack channel" onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} disabled={saving} className="btn-secondary">Cancel</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>}>
      <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">Linked channel</label>
      <select value={selected} onChange={e => setSelected(e.target.value)}
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md bg-white focus:outline-none focus:border-[#70A0D0]">
        <option value="">— Not linked —</option>
        {channels.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}
      </select>
      <p className="text-[11px] text-[#94a3b8] mt-2">Stage changes and other project-level events will post in this channel.</p>
      {err && <div className="mt-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
    </ModalShell>
  )
}

function DuplicateModal({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function duplicate() {
    setBusy(true); setErr(null)
    const res = await fetch(`/api/projects/${projectId}/duplicate`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(body?.error || 'Duplicate failed'); setBusy(false); return }
    router.push(`/projects/${body.project.id}`)
  }
  return (
    <ModalShell title="Duplicate project" onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button><button onClick={duplicate} disabled={busy} className="btn-primary">{busy ? 'Duplicating…' : 'Duplicate'}</button></div>}>
      <p className="text-[13px] text-[#3E3E3C]">
        We&apos;ll create a copy of <strong>{projectName}</strong> with the same site, utility, technical, and financial fields.
      </p>
      <p className="text-[12.5px] text-[#706E6B] mt-3">
        Tasks, areas, meters, systems, permits, and stakeholders are <strong>not</strong> copied — those are work items specific to each project.
      </p>
      {err && <div className="mt-2 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}
    </ModalShell>
  )
}

function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, danger }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function go() { setBusy(true); await onConfirm() }
  return (
    <ModalShell title={title} onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
          <button onClick={go} disabled={busy}
            className={danger
              ? 'px-3 py-1.5 rounded text-[13px] font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50'
              : 'btn-primary'}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }>
      <p className="text-[13px] text-[#3E3E3C] leading-relaxed">{body}</p>
    </ModalShell>
  )
}
