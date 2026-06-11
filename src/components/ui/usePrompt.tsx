'use client'
/**
 * usePrompt — an in-app replacement for window.prompt().
 *
 * Returns `{ prompt, dialog }`. Render `dialog` once anywhere in the component,
 * then call `await prompt({...})` from an event handler. Resolves to the entered
 * string, or null if cancelled — same contract as window.prompt, so call sites
 * stay a one-line swap.
 *
 *   const { prompt, dialog } = usePrompt()
 *   ...
 *   const name = await prompt({ title: 'Rename drawing', initial: d.file_name })
 *   if (name) { ... }
 *   ...
 *   return (<>{dialog}{rest of UI}</>)
 */
import { useState, useRef, useCallback } from 'react'

interface PromptOpts {
  title: string
  label?: string
  initial?: string
  placeholder?: string
  multiline?: boolean
  confirmLabel?: string
  required?: boolean
}

interface PromptState extends PromptOpts {
  open: boolean
  value: string
}

export function usePrompt() {
  const [state, setState] = useState<PromptState>({ open: false, title: '', value: '' })
  const resolver = useRef<((v: string | null) => void) | null>(null)

  const prompt = useCallback((opts: PromptOpts) => {
    setState({ ...opts, open: true, value: opts.initial ?? '' })
    return new Promise<string | null>(resolve => { resolver.current = resolve })
  }, [])

  const close = useCallback((result: string | null) => {
    setState(s => ({ ...s, open: false }))
    resolver.current?.(result)
    resolver.current = null
  }, [])

  const dialog = state.open ? (
    <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center p-4"
      onClick={() => close(null)}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[460px] overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-[#ECEBEA] font-bold text-[15px] text-[#080707]">{state.title}</div>
        <div className="px-5 py-4">
          {state.label && <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#706E6B] mb-1.5">{state.label}</label>}
          {state.multiline ? (
            <textarea
              autoFocus
              value={state.value}
              placeholder={state.placeholder}
              onChange={e => setState(s => ({ ...s, value: e.target.value }))}
              className="w-full min-h-[96px] px-3 py-2 text-[13px] border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 resize-y"
            />
          ) : (
            <input
              autoFocus
              type="text"
              value={state.value}
              placeholder={state.placeholder}
              onChange={e => setState(s => ({ ...s, value: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); if (!state.required || state.value.trim()) close(state.value) }
                else if (e.key === 'Escape') { e.preventDefault(); close(null) }
              }}
              className="w-full px-3 py-2 text-[13px] border border-[#cbd5e1] rounded focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
            />
          )}
        </div>
        <div className="px-5 py-3.5 border-t border-[#ECEBEA] bg-[#FBFCFE] flex justify-end gap-2">
          <button onClick={() => close(null)} className="btn-secondary">Cancel</button>
          <button
            onClick={() => close(state.value)}
            disabled={state.required ? !state.value.trim() : false}
            className="btn-primary disabled:opacity-50"
          >
            {state.confirmLabel ?? 'Save'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { prompt, dialog }
}
