'use client'
// Top-of-page progress bar + progress cursor while Pathwaze is working.
// Three sources feed the shared busy state in src/lib/busy.ts:
//   1. Link clicks to another in-app URL (ended when the URL changes)
//   2. Any mutating fetch to /api — covers every save in the app without each
//      component having to opt in
//   3. useSubmit()/useRefresh(), which also cover the router.refresh() after
//      a save
import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { beginBusy, beginNav, endNav, subscribeBusy } from '@/lib/busy'

// Don't flash the bar for requests that finish almost instantly.
const SHOW_DELAY_MS = 150

declare global {
  interface Window { __pathwazeFetchTracked?: boolean }
}

function isTrackedRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method === 'GET' || method === 'HEAD') return false
  const raw = input instanceof Request ? input.url : String(input)
  try {
    const url = new URL(raw, window.location.href)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

function trackFetch() {
  if (window.__pathwazeFetchTracked) return
  window.__pathwazeFetchTracked = true
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    if (!isTrackedRequest(input, init)) return original(input, init)
    const release = beginBusy()
    return original(input, init).finally(release)
  }
}

function onLinkClick(e: MouseEvent) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || a.hasAttribute('download')) return
  if (a.target && a.target !== '_self') return
  let url: URL
  try { url = new URL(a.href, window.location.href) } catch { return }
  if (url.origin !== window.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  // Same page (or only the #hash differs) — nothing to wait for.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return
  beginNav()
}

export function ActivityIndicator() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    trackFetch()
    document.addEventListener('click', onLinkClick, true)
    const unsub = subscribeBusy(setBusy)
    return () => { document.removeEventListener('click', onLinkClick, true); unsub() }
  }, [])

  // The URL changing is the signal a navigation has landed.
  useEffect(() => { endNav() }, [pathname, search])

  useEffect(() => {
    if (!busy) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [busy])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[1000] h-[3px] overflow-hidden">
      {visible && <div className="pw-progress h-full bg-[#E6C87A]" />}
    </div>
  )
}
