'use client'
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import Link from 'next/link'

const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  'Supportive': { bg: '#F0FDF4', text: '#166534' },
  'Neutral': { bg: '#F8FAFC', text: '#475569' },
  'Concerned': { bg: '#FFFBEB', text: '#92400e' },
  'Opposed': { bg: '#FEF2F2', text: '#991b1b' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StakeholdersClient({ stakeholders }: { stakeholders: any[] }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')
  const [trancheFilter, setTrancheFilter] = useState('All')

  const roles = ['All', ...Array.from(new Set(stakeholders.map(s => s.role).filter(Boolean)))]
  const tranches = ['All', ...Array.from(new Set(stakeholders.map(s => s.project?.tranche).filter(Boolean)))]

  const filtered = useMemo(() => stakeholders.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'All' || s.role === roleFilter
    const matchTranche = trancheFilter === 'All' || s.project?.tranche === trancheFilter
    return matchSearch && matchRole && matchTranche
  }), [stakeholders, search, roleFilter, trancheFilter])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2F3E50]">Stakeholders</h1>
        <p className="text-[#6E879E] text-sm mt-1">{filtered.length} contacts</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input type="text" placeholder="Search stakeholders..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none w-56" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {roles.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={trancheFilter} onChange={e => setTrancheFilter(e.target.value)} className="px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm">
          {tranches.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
              <th className="text-left px-4 py-3 label">Name</th>
              <th className="text-left px-4 py-3 label">Title</th>
              <th className="text-left px-4 py-3 label">Role</th>
              <th className="text-left px-4 py-3 label">Site</th>
              <th className="text-left px-4 py-3 label">Tranche</th>
              <th className="text-left px-4 py-3 label">Sentiment</th>
              <th className="text-left px-4 py-3 label">Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const sc = SENTIMENT_COLORS[s.sentiment] ?? { bg: '#F8FAFC', text: '#475569' }
              return (
                <tr key={s.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#2F3E50]">{s.name}</span>
                      {s.is_primary && <span className="text-[10px] bg-[#2F3E50] text-[#E6C87A] px-1.5 py-0.5 rounded">Primary</span>}
                    </div>
                    <p className="text-xs text-[#94a3b8]">{s.org}</p>
                  </td>
                  <td className="px-4 py-3 text-[#6E879E] text-xs max-w-[200px]">{s.title}</td>
                  <td className="px-4 py-3 text-[#6E879E]">{s.role}</td>
                  <td className="px-4 py-3">
                    {s.project ? (
                      <Link href={`/projects/${s.project_id}#stakeholders`} className="text-[#2F3E50] hover:underline text-xs">
                        {s.project.name}
                      </Link>
                    ) : <span className="text-xs text-[#94a3b8]">Global</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6E879E]">{s.project?.tranche ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>{s.sentiment}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6E879E]">
                    {s.email && s.email !== 'TBD' ? (
                      <a href={`mailto:${s.email}`} className="hover:text-[#2F3E50]">{s.email}</a>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
