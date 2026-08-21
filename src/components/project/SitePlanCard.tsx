'use client'
/**
 * Read-only Site Plan record for the Technical tab.
 *
 * Site plans are uploaded and linked to systems in the **Drawings** tab (the
 * 'Site Plans' collection). This card is a view only — no upload, no edit — so
 * there is exactly one write path for the file and its system linkage.
 */
import { FileText, ExternalLink } from 'lucide-react'
import { currentSitePlan, openSitePlan, type SitePlan } from './_sitePlans'
import type { SystemRow } from './SystemsTable'

export function SitePlanCard({ sitePlans, systems }: { sitePlans: SitePlan[]; systems: SystemRow[] }) {
  // Newest first: the most recent plan linked to a system is that system's current one.
  const ordered = [...sitePlans].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))
  const sysName = (id: string) => systems.find(s => s.id === id)?.name ?? null
  const currentIds = new Set(
    systems.map(s => currentSitePlan(sitePlans, s.id)?.id).filter(Boolean) as string[],
  )

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-[#181818]">Site Plan</h3>
          <p className="text-[11.5px] text-[#706E6B] mt-0.5">
            Uploaded and linked to systems in the <b>Drawings</b> tab, under Site Plans.
          </p>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">
          No site plan on record. Upload one in the <b>Drawings</b> tab, under Site Plans, and link it to the
          systems it covers.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
              <th className="text-left px-4 py-3 label">Plan</th>
              <th className="text-left px-4 py-3 label">Revision</th>
              <th className="text-left px-4 py-3 label">Systems Covered</th>
              <th className="text-left px-4 py-3 label">Uploaded</th>
              <th className="text-left px-4 py-3 label">By</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {ordered.map(p => {
              const names = (p.system_ids ?? []).map(sysName).filter(Boolean) as string[]
              return (
                <tr key={p.id} className="border-b border-[#f1f5f9] last:border-b-0">
                  <td className="px-4 py-3 font-medium text-[#181818]">
                    <span className="inline-flex items-center gap-2">
                      <FileText size={14} className="text-[#b91c1c] shrink-0" />
                      {p.file_name}
                      {currentIds.has(p.id) && (
                        <span className="text-[9.5px] font-extrabold uppercase px-[7px] py-0.5 rounded bg-[#F0FDF4] border border-[#bbf7d0] text-[#166534]">Current</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{p.set_label ?? '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{names.length ? names.join(', ') : '—'}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{new Date(p.uploaded_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-[#3E3E3C]">{p.uploaded_by_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.storage_path ? (
                      <button onClick={() => openSitePlan(p.storage_path)}
                        className="text-[12px] text-[#2C5485] hover:underline inline-flex items-center gap-1">
                        Open <ExternalLink size={11} />
                      </button>
                    ) : <span className="text-[#94a3b8]">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
