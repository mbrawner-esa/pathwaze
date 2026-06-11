'use client'
// A "Received from" picker: choose an internal user or a stakeholder, or add a
// new stakeholder inline. Emits (userId, stakeholderId) — only one is set.
type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

export function ReceivedFromPicker({ users, stakeholders, projectId, userId, stakeholderId, onChange, onStakeholderCreated }: {
  users: Any[]; stakeholders: Any[]; projectId?: string | null
  userId?: string | null; stakeholderId?: string | null
  onChange: (userId: string | null, stakeholderId: string | null) => void
  onStakeholderCreated?: (s: Any) => void
}) {
  const value = userId ? `u:${userId}` : stakeholderId ? `s:${stakeholderId}` : ''

  async function addStakeholder() {
    const name = window.prompt('New stakeholder name')?.trim()
    if (!name) return
    const res = await fetch('/api/stakeholders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId ?? null, name }),
    })
    if (res.ok) { const s = await res.json(); onStakeholderCreated?.(s); onChange(null, s.id) }
    else alert('Could not add stakeholder.')
  }

  return (
    <div className="flex items-center gap-2">
      <select value={value}
        onChange={e => {
          const v = e.target.value
          if (v.startsWith('u:')) onChange(v.slice(2), null)
          else if (v.startsWith('s:')) onChange(null, v.slice(2))
          else onChange(null, null)
        }}
        className="flex-1 min-w-0 border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[13px] font-[inherit] bg-white">
        <option value="">— Select —</option>
        <optgroup label="Internal">
          {users.map(u => <option key={u.id} value={`u:${u.id}`}>{u.full_name}</option>)}
        </optgroup>
        <optgroup label="Stakeholders">
          {stakeholders.map(s => <option key={s.id} value={`s:${s.id}`}>{s.name}</option>)}
        </optgroup>
      </select>
      <button type="button" className="btn-secondary whitespace-nowrap" onClick={addStakeholder}>+ Stakeholder</button>
    </div>
  )
}
