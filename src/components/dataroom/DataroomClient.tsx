'use client'
import { useState } from 'react'
import Link from 'next/link'

interface CatStat { id: string; label: string; pct: number; uploaded: number; total: number }
interface ProjectStat {
  id: string; name: string; project_number: string; tranche: string; stage: string
  uploaded: number; total: number; pct: number; catStats: CatStat[]
}

const CAT_COLORS: Record<string, string> = {
  '0': '#6366f1', '1': '#059669', '2': '#2563eb', '3': '#d97706', '4': '#7c3aed', '5': '#dc2626', '6': '#0891b2'
}

function DonutRing({ pct, color, label, size = 60 }: { pct: number; color: string; label: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <p className="text-[10px] text-center text-[#6E879E] max-w-[60px] leading-tight">{label}</p>
      <p className="text-xs font-bold" style={{ color }}>{pct}%</p>
    </div>
  )
}

export function DataroomClient({
  projectStats, globalPct, globalUploaded, globalTotal,
  fullyComplete, needsAttention, avgPct, catPortfolioStats, categories
}: {
  projectStats: ProjectStat[]
  globalPct: number; globalUploaded: number; globalTotal: number
  fullyComplete: number; needsAttention: number; avgPct: number
  catPortfolioStats: CatStat[]
  categories: { id: string; label: string }[]
}) {
  const [trancheFilter, setTrancheFilter] = useState('All')
  const tranches = ['All', ...Array.from(new Set(projectStats.map(p => p.tranche).filter(Boolean)))]

  const filtered = projectStats.filter(p => trancheFilter === 'All' || p.tranche === trancheFilter)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2F3E50]">Dataroom Health</h1>
        <p className="text-[#6E879E] text-sm mt-1">Portfolio document completion tracking</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="card p-4 col-span-1">
          <p className="label mb-1">Overall Completion</p>
          <p className="text-3xl font-bold text-[#2F3E50]">{globalPct}%</p>
          <p className="text-xs text-[#6E879E]">{globalUploaded} / {globalTotal}</p>
        </div>
        <div className="card p-4">
          <p className="label mb-1">Avg Per Project</p>
          <p className="text-3xl font-bold text-[#6E879E]">{avgPct}%</p>
          <p className="text-xs text-[#6E879E]">portfolio avg</p>
        </div>
        <div className="card p-4">
          <p className="label mb-1">Total Docs</p>
          <p className="text-3xl font-bold text-[#2F3E50]">{globalTotal}</p>
          <p className="text-xs text-[#6E879E]">across all projects</p>
        </div>
        <div className="card p-4">
          <p className="label mb-1">Fully Complete</p>
          <p className="text-3xl font-bold text-green-600">{fullyComplete}</p>
          <p className="text-xs text-[#6E879E]">projects</p>
        </div>
        <div className="card p-4">
          <p className="label mb-1">Needs Attention</p>
          <p className="text-3xl font-bold text-red-500">{needsAttention}</p>
          <p className="text-xs text-[#6E879E]">under 25%</p>
        </div>
      </div>

      {/* Category Donuts */}
      <div className="card p-6 mb-6">
        <h2 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Category Completion (Portfolio-Wide)</h2>
        <div className="flex gap-8 flex-wrap">
          {catPortfolioStats.map(cat => (
            <DonutRing key={cat.id} pct={cat.pct} color={CAT_COLORS[cat.id] ?? '#6E879E'} label={cat.label} size={72} />
          ))}
        </div>
      </div>

      {/* Project Matrix */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#f1f5f9]">
          <h2 className="text-sm font-bold text-[#2F3E50] uppercase tracking-wider">Project Completion Matrix</h2>
          <select value={trancheFilter} onChange={e => setTrancheFilter(e.target.value)} className="px-3 py-1.5 border border-[#e2e8f0] rounded-lg text-sm">
            {tranches.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-4 py-3 label sticky left-0 bg-[#f8fafc]">Project</th>
                <th className="text-left px-4 py-3 label">Overall</th>
                {categories.map(c => (
                  <th key={c.id} className="px-3 py-3 label text-center" style={{ color: CAT_COLORS[c.id] }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-2.5 sticky left-0 bg-white">
                    <Link href={`/projects/${p.id}`} className="font-medium text-[#2F3E50] hover:underline text-xs">{p.name}</Link>
                    <p className="text-[10px] text-[#94a3b8]">{p.tranche}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.pct >= 75 ? '#22c55e' : p.pct >= 40 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                      <span className="text-[10px] font-medium text-[#6E879E]">{p.pct}%</span>
                    </div>
                  </td>
                  {p.catStats.map(cat => (
                    <td key={cat.id} className="px-3 py-2.5 text-center">
                      <span className="inline-block w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center"
                        style={{
                          backgroundColor: cat.pct === 100 ? '#F0FDF4' : cat.pct > 0 ? '#FFFBEB' : '#FEF2F2',
                          color: cat.pct === 100 ? '#166534' : cat.pct > 0 ? '#92400e' : '#991b1b'
                        }}>
                        {cat.pct}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
