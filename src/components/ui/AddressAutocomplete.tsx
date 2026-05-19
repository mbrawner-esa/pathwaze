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
  /** Initial value displayed in the search box */
  initial?: string
  /** Fired when user picks a place from the dropdown */
  onSelect: (a: AddressData) => void
  placeholder?: string
  required?: boolean
}

// ─── Maps loader ───────────────────────────────────────────────────
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AddressComponent = { longText: string; shortText: string; types: string[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePlace(place: any): AddressData {
  const components: AddressComponent[] = place.addressComponents || []
  const get = (type: string) => components.find(c => c.types.includes(type))?.longText ?? ''
  const getShort = (type: string) => components.find(c => c.types.includes(type))?.shortText ?? ''

  const lat = typeof place.location?.lat === 'function' ? place.location.lat() : (place.location?.lat ?? null)
  const lng = typeof place.location?.lng === 'function' ? place.location.lng() : (place.location?.lng ?? null)

  return {
    street: [get('street_number'), get('route')].filter(Boolean).join(' ').trim(),
    city: get('locality') || get('sublocality') || get('postal_town') || get('administrative_area_level_2') || '',
    state: getShort('administrative_area_level_1'),
    zip: get('postal_code'),
    lat,
    lng,
    formatted: place.formattedAddress || '',
  }
}

export function AddressAutocomplete({ initial, onSelect, placeholder, required }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Snapshot initial value so changes don't re-mount the autocomplete
  const initialRef = useRef(initial)

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setLoaded(true))
      .catch(e => setError(e instanceof Error ? e.message : 'Maps unavailable'))
  }, [])

  useEffect(() => {
    if (!loaded || !containerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    if (!g?.maps?.places?.PlaceAutocompleteElement) return

    // Create the new web-component-based autocomplete
    const el = new g.maps.places.PlaceAutocompleteElement({
      includedRegionCodes: ['us'],
      // types: ['address'],  // optional; comment out for broader results
    })
    if (initialRef.current) {
      try { (el as HTMLInputElement & { value: string }).value = initialRef.current } catch { /* noop */ }
    }
    // Apply some sensible default styling so it matches our inputs
    el.style.width = '100%'

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(el)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = async (event: any) => {
      try {
        const prediction = event?.placePrediction
        if (!prediction) return
        const place = prediction.toPlace()
        await place.fetchFields({
          fields: ['addressComponents', 'formattedAddress', 'location'],
        })
        onSelectRef.current(parsePlace(place))
      } catch (e) {
        console.warn('[address-autocomplete] place fetch failed:', e)
      }
    }
    el.addEventListener('gmp-select', handler)

    return () => {
      try {
        el.removeEventListener('gmp-select', handler)
        el.remove()
      } catch { /* noop */ }
    }
  }, [loaded])

  // Fallback when the API key is missing
  if (error) {
    return (
      <input
        type="text"
        defaultValue={initial}
        placeholder={placeholder || 'Start typing an address…'}
        className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20"
        required={required}
      />
    )
  }

  return (
    <div
      className="pathwaze-autocomplete-host"
      style={{
        width: '100%',
        minHeight: 32,
        display: 'block',
        whiteSpace: 'normal',
        overflow: 'visible',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', minHeight: 30 }} />
      {!loaded && (
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Loading…</p>
      )}
    </div>
  )
}
