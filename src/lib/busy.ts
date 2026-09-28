// App-wide "working…" state. Anything in flight — a page navigation, a save,
// the router.refresh() that follows one — holds a token; while any token is
// held, <html data-busy> is set (progress cursor, see globals.css) and the
// top progress bar in <ActivityIndicator> is shown.
//
// Why this exists: App Router navigations are client-side, so Chrome's own
// reload/stop spinner never runs, and a save that looks like it did nothing
// gets submitted twice (ROADMAP R-16).

type Listener = (busy: boolean) => void

let count = 0
const listeners = new Set<Listener>()

function emit() {
  const busy = count > 0
  if (typeof document !== 'undefined') {
    if (busy) document.documentElement.dataset.busy = ''
    else delete document.documentElement.dataset.busy
  }
  listeners.forEach(l => l(busy))
}

/** Hold a busy token. Returns the release function — safe to call twice. */
export function beginBusy(): () => void {
  count++
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    count = Math.max(0, count - 1)
    emit()
  }
}

export function subscribeBusy(l: Listener): () => void {
  listeners.add(l)
  l(count > 0)
  return () => { listeners.delete(l) }
}

// ── Navigation ─────────────────────────────────────────────────────────
// A navigation ends when the URL changes (ActivityIndicator calls endNav on
// pathname/search change). The timeout is a backstop for a click that never
// actually navigates, so the cursor can't stick.
const NAV_TIMEOUT_MS = 12_000
let releaseNav: (() => void) | null = null
let navTimer: ReturnType<typeof setTimeout> | null = null

export function endNav() {
  if (navTimer) clearTimeout(navTimer)
  navTimer = null
  releaseNav?.()
  releaseNav = null
}

/** Call before a programmatic router.push() so it gets the same indicator a
 *  link click does. Link clicks are picked up automatically. */
export function beginNav() {
  endNav()
  releaseNav = beginBusy()
  navTimer = setTimeout(endNav, NAV_TIMEOUT_MS)
}
