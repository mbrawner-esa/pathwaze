'use client'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { beginBusy } from './busy'

/**
 * router.refresh() that tells you when the fresh data has actually landed.
 *
 * A bare `onClose(); router.refresh()` closes the form seconds before the new
 * row appears — it reads as "that didn't work" and invites a second submit.
 * `refresh(onClose)` keeps the form (and its Saving… state) up until the
 * refreshed server data has rendered, then calls `then`.
 */
export function useRefresh() {
  const router = useRouter()
  const [refreshing, startTransition] = useTransition()
  const then = useRef<(() => void) | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (refreshing) {
      started.current = true
      return beginBusy()
    }
    // useTransition always flips isPending true → false, so this runs once
    // the refresh has committed.
    if (started.current) {
      started.current = false
      const f = then.current
      then.current = null
      f?.()
    }
  }, [refreshing])

  const refresh = useCallback((after?: () => void) => {
    then.current = after ?? null
    startTransition(() => router.refresh())
  }, [router])

  return { refresh, refreshing }
}

/**
 * Double-submit guard for a save/post handler.
 *
 *   const { run, busy } = useSubmit()
 *   run(async () => { const res = await fetch(…); return res.ok }, { refresh: true, onDone: onClose })
 *
 * - A second call while one is in flight is ignored (double-click, double-Enter).
 * - `fn` returns `false` to signal failure: no refresh, no onDone, lock released.
 * - With `refresh`, `busy` stays true — and onDone waits — until the refreshed
 *   data is on screen.
 * - Holds the app-wide busy cursor for the whole span.
 */
export function useSubmit() {
  const { refresh } = useRefresh()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)

  const run = useCallback(async (
    fn: () => Promise<boolean | void>,
    opts: { refresh?: boolean; onDone?: () => void } = {},
  ) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    const release = beginBusy()
    const finish = () => { lock.current = false; setBusy(false); release() }

    let ok: boolean | void = false
    try {
      ok = await fn()
    } catch (e) {
      finish()
      throw e
    }
    if (ok === false) { finish(); return }
    if (opts.refresh) refresh(() => { finish(); opts.onDone?.() })
    else { finish(); opts.onDone?.() }
  }, [refresh])

  return { run, busy }
}
