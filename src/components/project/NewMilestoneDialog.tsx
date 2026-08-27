'use client'
import { useEffect, useRef, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { RichTextEditor } from '@/components/ui/RichTextEditor'

export interface NewMilestoneValues {
  label: string
  description: string
  stage_gate: string
  weight_pct: number
  is_critical: boolean
}

/**
 * Captured when a milestone is created, because these four are what make the
 * milestone measurable later — asking for them up front is much more reliable
 * than hoping someone fills them in afterwards.
 */
export function NewMilestoneDialog({
  majorLabel, weightRemaining, busy, onCancel, onCreate,
}: {
  majorLabel: string
  /** how much of the major's 100% is still unallocated — informs the default */
  weightRemaining: number
  busy: boolean
  onCancel: () => void
  onCreate: (values: NewMilestoneValues) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [stageGate, setStageGate] = useState('')
  const [weight, setWeight] = useState(String(Math.max(0, Math.round(weightRemaining))))
  const [isCritical, setIsCritical] = useState(false)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { firstFieldRef.current?.focus() }, [])

  // Escape closes, matching every other dismissible surface in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const weightNum = Number(weight)
  const weightValid = weight === '' || (!Number.isNaN(weightNum) && weightNum >= 0 && weightNum <= 100)
  const overAllocated = weightValid && weightNum > weightRemaining + 0.01
  const canSave = !!label.trim() && weightValid && !busy

  function submit() {
    if (!canSave) return
    onCreate({
      label: label.trim(),
      description,
      stage_gate: stageGate.trim(),
      weight_pct: weight === '' ? 0 : weightNum,
      is_critical: isCritical,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
      style={{ background: 'rgba(31,41,53,.35)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-ms-title"
        className="bg-white rounded-lg shadow-xl w-full my-8"
        style={{ maxWidth: 560 }}
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-[#E4EAF0]">
          <div>
            <h3 id="new-ms-title" className="m-0 text-[16px] font-bold tracking-tight text-[#181818]">
              New Milestone
            </h3>
            <p className="m-0 mt-0.5 text-[12.5px] text-[#706E6B]">under {majorLabel}</p>
          </div>
          <button
            type="button" onClick={onCancel} aria-label="Close"
            className="ml-auto w-7 h-7 grid place-items-center rounded border border-[#D6DEE7] text-[#55677A] hover:bg-[#F1F5F9]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 grid gap-4">
          <Field label="Milestone Name" required>
            <input
              ref={firstFieldRef}
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="e.g. Fire marshal review cleared"
              className="w-full text-[13.5px] px-2.5 py-2 border border-[#D6DEE7] rounded"
            />
          </Field>

          <Field label="Description" hint="What this milestone covers.">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="What does this milestone involve?"
              minHeight={70}
            />
          </Field>

          <Field label="Stage Gate" hint="What has to be true for this to count as done?">
            <input
              value={stageGate}
              onChange={e => setStageGate(e.target.value)}
              placeholder="e.g. Written sign-off from the AHJ on file"
              className="w-full text-[13.5px] px-2.5 py-2 border border-[#D6DEE7] rounded"
            />
          </Field>

          <Field
            label="Share of This Major Milestone"
            hint="Used to weight the progress bar. Milestones under a major should total 100%."
          >
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number" min={0} max={100} step={1}
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="text-[13.5px] px-2.5 py-2 border border-[#D6DEE7] rounded"
                style={{ width: 90 }}
              />
              <span className="text-[13px] text-[#706E6B]">%</span>
              <span className="text-[12px] text-[#9AA7B4]">
                {weightRemaining > 0
                  ? `${Math.round(weightRemaining * 100) / 100}% unallocated`
                  : 'this major is fully allocated'}
              </span>
            </div>
            {!weightValid && (
              <p className="flex items-center gap-1.5 mt-1.5 m-0 text-[12px]" style={{ color: '#991B1B' }}>
                <AlertTriangle size={12} /> Enter a number between 0 and 100.
              </p>
            )}
            {overAllocated && (
              <p className="flex items-center gap-1.5 mt-1.5 m-0 text-[12px]" style={{ color: '#92400E' }}>
                <AlertTriangle size={12} /> This takes the major over 100%. You can still save it and rebalance later.
              </p>
            )}
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isCritical}
              onChange={e => setIsCritical(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13.5px] font-semibold text-[#181818]">On the Critical Path</span>
              <span className="block text-[12px] text-[#706E6B]">
                Slipping this milestone pushes the whole project.
              </span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[#E4EAF0] bg-[#FAFCFD]">
          <button
            type="button" onClick={onCancel}
            className="text-[13px] font-semibold px-3 py-2 rounded border border-[#D6DEE7] text-[#55677A] hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button" onClick={submit} disabled={!canSave}
            className="text-[13px] font-bold px-3.5 py-2 rounded disabled:opacity-50"
            style={{ background: '#2F3E50', color: '#fff' }}
          >
            {busy ? 'Creating…' : 'Create Milestone'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-[#3E3E3C] mb-1">
        {label}
        {required && <span style={{ color: '#C8963A' }}> *</span>}
      </span>
      {hint && <span className="block text-[11.5px] text-[#9AA7B4] mb-1.5">{hint}</span>}
      {children}
    </label>
  )
}
