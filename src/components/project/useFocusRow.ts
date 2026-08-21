'use client'
import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

// Deep-link helper: when the URL carries ?focus=<id> that matches one of the
// given row ids, invoke open(id) once (after a short delay so the tab has
// mounted). Used to auto-open an entity's drawer when it's clicked from the
// activity feed or the notification bell.
export function useFocusRow(rowIds: string[], open: (id: string) => void) {
  const focus = useSearchParams().get('focus')
  const openRef = useRef(open)
  openRef.current = open
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!focus || firedFor.current === focus) return
    if (!rowIds.includes(focus)) return
    firedFor.current = focus
    const t = setTimeout(() => openRef.current(focus), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, rowIds.length])
}
