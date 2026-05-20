interface SiteTabProps {
  project: Record<string, unknown>
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <p className="text-sm text-[#334155]">{value ?? '—'}</p>
    </div>
  )
}

export function SiteTab({ project }: SiteTabProps) {
  const p = project as {
    address: string; city: string; state: string; zip: string
    facility_type: string; site_type: string; site_acres: number
    ahj: string; lat: number; lng: number
  }
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Site Information</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Address" value={`${p.address}, ${p.city}, ${p.state} ${p.zip}`} />
          <Field label="Facility Type" value={p.facility_type} />
          <Field label="Site Type" value={p.site_type} />
          <Field label="Site Acres" value={p.site_acres ? `${p.site_acres} ac` : '—'} />
          <Field label="AHJ" value={p.ahj} />
        </div>
      </div>
      {p.lat && p.lng && (
        <div className="card overflow-hidden">
          <iframe
            title="Site Map"
            width="100%"
            height="280"
            style={{ border: 0 }}
            src={`https://maps.google.com/maps?q=${p.lat},${p.lng}&z=15&output=embed`}
            allowFullScreen
          />
        </div>
      )}
    </div>
  )
}
