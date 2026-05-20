const SENTIMENT_COLORS: Record<string, { bg: string; text: string }> = {
  'Supportive': { bg: '#F0FDF4', text: '#166534' },
  'Neutral': { bg: '#F8FAFC', text: '#475569' },
  'Concerned': { bg: '#FFFBEB', text: '#92400e' },
  'Opposed': { bg: '#FEF2F2', text: '#991b1b' },
}

interface Stakeholder {
  id: string
  name: string
  title: string
  department: string
  role: string
  email: string
  phone: string
  sentiment: string
  is_primary: boolean
  org: string
}

export function StakeholdersTab({ stakeholders }: { stakeholders: Stakeholder[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
            <th className="text-left px-4 py-3 label">Name</th>
            <th className="text-left px-4 py-3 label">Title</th>
            <th className="text-left px-4 py-3 label">Role</th>
            <th className="text-left px-4 py-3 label">Department</th>
            <th className="text-left px-4 py-3 label">Sentiment</th>
            <th className="text-left px-4 py-3 label">Email</th>
          </tr>
        </thead>
        <tbody>
          {stakeholders.map(s => {
            const sentColors = SENTIMENT_COLORS[s.sentiment] ?? { bg: '#F8FAFC', text: '#475569' }
            return (
              <tr key={s.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#2F3E50]">{s.name}</span>
                    {s.is_primary && (
                      <span className="text-[10px] bg-[#2F3E50] text-[#E6C87A] px-1.5 py-0.5 rounded">Primary</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#6E879E]">{s.title}</td>
                <td className="px-4 py-3 text-[#6E879E]">{s.role}</td>
                <td className="px-4 py-3 text-[#6E879E]">{s.department}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sentColors.bg, color: sentColors.text }}>
                    {s.sentiment}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#6E879E]">
                  {s.email && s.email !== 'TBD' ? (
                    <a href={`mailto:${s.email}`} className="hover:text-[#2F3E50]">{s.email}</a>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
          {!stakeholders.length && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-[#94a3b8]">No stakeholders yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
