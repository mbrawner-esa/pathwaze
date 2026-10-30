'use client'
// Pick any number of internal users to CC on an RFI: chips for who is on the
// list plus a dropdown to add more. Controlled — the parent owns the id list.
type Any = any // eslint-disable-line @typescript-eslint/no-explicit-any

export function CcPicker({ users, value, onChange, disabled, exclude = [] }: {
  users: Any[]; value: string[]; onChange: (ids: string[]) => void; disabled?: boolean
  /** User ids to leave out of the dropdown (e.g. ones already on the RFI as ball-in-court). */
  exclude?: string[]
}) {
  const nameOf = (id: string) => users.find(u => u.id === id)?.full_name ?? '(unknown user)'
  const available = users.filter(u => !value.includes(u.id) && !exclude.includes(u.id))
  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(id => (
            <span key={id} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2C5485] bg-[#EFF4FA] border border-[#cfe0ef] rounded-full pl-2.5 pr-1.5 py-0.5">
              {nameOf(id)}
              <button type="button" disabled={disabled} onClick={() => onChange(value.filter(v => v !== id))}
                className="text-[#A8A8A8] hover:text-[#b91c1c] text-[14px] leading-none px-0.5" title="Remove from CC">×</button>
            </span>
          ))}
        </div>
      )}
      <select value="" disabled={disabled || available.length === 0}
        onChange={e => { if (e.target.value) onChange([...value, e.target.value]) }}
        className="border border-[#DDDBDA] rounded-md px-2 py-1.5 text-[12px] w-full">
        <option value="">{available.length === 0 ? 'No more users to add' : 'Add a person to CC…'}</option>
        {available.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
      </select>
    </div>
  )
}
