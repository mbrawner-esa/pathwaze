import { formatDate } from '@/lib/utils'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-sm text-[#334155]">{value ?? '—'}</p>
    </div>
  )
}

interface Permit {
  id: string
  name: string
  category: string
  level: string
  status: string
  ahj: string | null
  submitted_at: string | null
  approved_at: string | null
  notes: string | null
}

export function PermittingTab({ project, permits }: { project: Record<string, unknown>; permits: Permit[] }) {
  const p = project as {
    building_permit_num: string; building_permit_status: string
    electrical_permit_num: string; permit_submitted: string | null; permit_approved: string | null
    inspector: string; ahj: string
  }

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'Not Started': { bg: '#F8FAFC', text: '#475569' },
    'In Progress': { bg: '#EFF6FF', text: '#1d4ed8' },
    'Submitted': { bg: '#FFFBEB', text: '#92400e' },
    'Approved': { bg: '#F0FDF4', text: '#166534' },
    'Denied': { bg: '#FEF2F2', text: '#991b1b' },
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Permit Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="AHJ" value={p.ahj} />
          <Field label="Building Permit #" value={p.building_permit_num} />
          <Field label="Building Permit Status" value={p.building_permit_status} />
          <Field label="Electrical Permit #" value={p.electrical_permit_num} />
          <Field label="Permit Submitted" value={formatDate(p.permit_submitted)} />
          <Field label="Permit Approved" value={formatDate(p.permit_approved)} />
          <Field label="Inspector" value={p.inspector} />
        </div>
      </div>

      {permits.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#f1f5f9]">
            <h3 className="text-sm font-bold text-[#2F3E50] uppercase tracking-wider">Permit Register</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="text-left px-4 py-3 label">Permit</th>
                <th className="text-left px-4 py-3 label">Category</th>
                <th className="text-left px-4 py-3 label">Level</th>
                <th className="text-left px-4 py-3 label">AHJ</th>
                <th className="text-left px-4 py-3 label">Status</th>
                <th className="text-left px-4 py-3 label">Submitted</th>
                <th className="text-left px-4 py-3 label">Approved</th>
              </tr>
            </thead>
            <tbody>
              {permits.map(permit => {
                const sc = STATUS_COLORS[permit.status] ?? { bg: '#F8FAFC', text: '#475569' }
                return (
                  <tr key={permit.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="px-4 py-3 font-medium text-[#2F3E50]">{permit.name}</td>
                    <td className="px-4 py-3 text-[#6E879E]">{permit.category}</td>
                    <td className="px-4 py-3 text-[#6E879E]">{permit.level}</td>
                    <td className="px-4 py-3 text-[#6E879E]">{permit.ahj ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {permit.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#6E879E]">{formatDate(permit.submitted_at)}</td>
                    <td className="px-4 py-3 text-[#6E879E]">{formatDate(permit.approved_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
