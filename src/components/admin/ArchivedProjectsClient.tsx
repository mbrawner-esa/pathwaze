'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Archive, RotateCcw, Trash2, ExternalLink, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export interface ArchivedProjectRow {
  id: string
  project_number: string | null
  name: string
  stage: string
  customer: string | null
  city: string | null
  state: string | null
  tranche: string | null
  system_kwdc: number | null
  target_cod: string | null
  archived_at: string | null
  created_at: string | null
}

export function ArchivedProjectsClient({ projects: initial }: { projects: ArchivedProjectRow[] }) {
  const router = useRouter()
  const [projects, setProjects] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ArchivedProjectRow | null>(null)

  async function unarchive(id: string) {
    setBusy(id); setErr(null)
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'Pre-Planning' }),
    })
    if (res.ok) {
      setProjects(p => p.filter(x => x.id !== id))
      router.refresh()
    } else {
      const b = await res.json().catch(() => ({}))
      setErr(b?.error || 'Unarchive failed')
    }
    setBusy(null)
  }

  async function hardDelete(id: string) {
    setBusy(id); setErr(null)
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setProjects(p => p.filter(x => x.id !== id))
      setConfirmDelete(null)
      router.refresh()
    } else {
      const b = await res.json().catch(() => ({}))
      setErr(b?.error || 'Delete failed')
    }
    setBusy(null)
  }

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#181818] tracking-tight flex items-center gap-2">
            <Archive size={20} className="text-[#706E6B]" /> Archived projects
          </h1>
          <p className="text-[13px] text-[#706E6B] mt-1">
            Hidden from the main lists program-wide. Unarchive to restore to active work, or permanently delete.
          </p>
        </div>
        <Link href="/projects" className="text-[12.5px] text-[#2C5485] hover:underline mt-1">← Back to projects</Link>
      </div>

      {err && (
        <div className="mb-4 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12.5px] text-[#991b1b]">
          {err}
        </div>
      )}

      <div className="card overflow-hidden">
        {projects.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Archive size={28} className="mx-auto text-[#cbd5e1] mb-3" />
            <p className="text-[13px] text-[#706E6B]">No archived projects.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#fafafa]">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Project</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Customer</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Tranche</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Size</th>
                <th className="text-left px-3 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Archived</th>
                <th className="text-right px-5 py-3 text-[11px] font-bold text-[#706E6B] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/projects/${p.id}`} className="font-medium text-[#181818] hover:text-[#2C5485] hover:underline">
                        {p.name}
                      </Link>
                      <ExternalLink size={11} className="text-[#94a3b8]" />
                    </div>
                    {p.project_number && <p className="text-[11px] text-[#706E6B] mt-0.5">{p.project_number}</p>}
                  </td>
                  <td className="px-3 py-3 text-[13px] text-[#3E3E3C]">{p.customer ?? '—'}</td>
                  <td className="px-3 py-3 text-[13px] text-[#3E3E3C]">{p.tranche ?? '—'}</td>
                  <td className="px-3 py-3 text-[13px] text-[#3E3E3C]">{p.system_kwdc != null ? `${p.system_kwdc.toLocaleString()} kWdc` : '—'}</td>
                  <td className="px-3 py-3 text-[12.5px] text-[#706E6B]">{p.archived_at ? formatDate(p.archived_at) : '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => unarchive(p.id)}
                        disabled={busy === p.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-[#3E3E3C] bg-white border border-[#e2e8f0] rounded hover:bg-[#fafbfc] disabled:opacity-50 transition-colors"
                        title="Restore to Pre-Planning"
                      >
                        <RotateCcw size={11} /> Unarchive
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        disabled={busy === p.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] rounded disabled:opacity-50 transition-colors"
                        title="Permanently delete"
                      >
                        <Trash2 size={11} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmDelete && (
        <>
          <div onClick={() => setConfirmDelete(null)} className="fixed inset-0 bg-black/30 z-40" />
          <div className="fixed left-1/2 top-[18vh] -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#f1f5f9] flex items-start gap-3">
              <AlertTriangle size={20} className="text-[#dc2626] flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14.5px] font-bold text-[#181818]">Permanently delete project?</h3>
                <p className="text-[12.5px] text-[#706E6B] mt-1">This cannot be undone.</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[13px] text-[#3E3E3C] leading-relaxed">
                <strong>{confirmDelete.name}</strong> and all its tasks, areas, meters, systems, permits, stakeholders, and documents will be permanently deleted.
              </p>
            </div>
            <div className="px-5 py-3 bg-[#fafbfc] border-t border-[#f1f5f9] flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} disabled={busy === confirmDelete.id} className="btn-secondary">Cancel</button>
              <button
                onClick={() => hardDelete(confirmDelete.id)}
                disabled={busy === confirmDelete.id}
                className="px-3 py-1.5 rounded text-[13px] font-semibold text-white bg-[#dc2626] hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {busy === confirmDelete.id ? 'Deleting…' : "Yes I'm sure — delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
