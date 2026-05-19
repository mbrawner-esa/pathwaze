'use client'
import { useEffect, useRef, useState } from 'react'

export interface AddressData {
  street: string
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  formatted: string
}

interface Props {
  /** Initial value to seed the input with (e.g. existing project address) */
  initial?: string
  /** Called when user selects a place from the dropdown */
  onSelect: (a: AddressData) => void
  placeholder?: string
  className?: string
  required?: boolean
}

// ─── Google Maps lazy loader ───────────────────────────────────────
// Loads the Maps JS API + places library on first use. Idempotent —
// multiple components can call this; the script tag is only added once.
let loadPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.places) return Promise.resolve()
  if (loadPromise) return loadPromise

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured'))

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps script failed to load')))
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`
    script.async = true
    script.defer = true
    script.dataset.googleMapsLoader = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps script failed to load'))
    document.head.appendChild(script)
  })
  return loadPromise
}

// Map Google's address_components into our flat AddressData shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePlace(place: any): AddressData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const components: Array<{ long_name: string; short_name: string; types: string[] }> = place.address_components || []
  const get = (type: string) => components.find(c => c.types.includes(type))?.long_name ?? ''
  const getShort = (type: string) => components.find(c => c.types.includes(type))?.short_name ?? ''

  return {
    street: [get('street_number'), get('route')].filter(Boolean).join(' ').trim(),
    city: get('locality') || get('sublocality') || get('postal_town') || get('administrative_area_level_2') || '',
    state: getShort('administrative_area_level_1'),
    zip: get('postal_code'),
    lat: place.geometry?.location ? place.geometry.location.lat() : null,
    lng: place.geometry?.location ? place.geometry.location.lng() : null,
    formatted: place.formatted_address || '',
  }
}

export function AddressAutocomplete({ initial, onSelect, placeholder, className, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mount: lazy-load Google Maps script
  useEffect(() => {
    loadGoogleMaps()
      .then(() => setLoaded(true))
      .catch(e => setError(e instanceof Error ? e.message : 'Maps unavailable'))
  }, [])

  // Once loaded + input is in DOM, attach Autocomplete
  useEffect(() => {
    if (!loaded || !inputRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    if (!g?.maps?.places?.Autocomplete) return

    const autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address', 'geometry.location'],
    })

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place?.geometry?.location) return
      onSelect(parsePlace(place))
    })

    return () => {
      try { g.maps.event.removeListener(listener) } catch { /* noop */ }
    }
  }, [loaded, onSelect])

  const inputClass = className || 'w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20'

  // Graceful fallback when API key is missing or load fails — just a plain input.
  // The parent component still receives onChange via its own logic if it falls back to manual fields.
  if (error) {
    return (
      <input
        type="text"
        defaultValue={initial}
        placeholder={placeholder || 'Start typing an address…'}
        className={inputClass}
        required={required}
      />
    )
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={initial}
      placeholder={loaded ? (placeholder || 'Start typing an address…') : 'Loading address search…'}
      className={inputClass}
      required={required}
      // Stop browser autofill from competing with Google's dropdown
      autoComplete="off"
    />
  )
}
