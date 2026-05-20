import { createClient } from '@/lib/supabase/server'
import { DataroomClient } from '@/components/dataroom/DataroomClient'

const DR_CATEGORIES = [
  { id: '0', label: 'Legal Entity', subs: [
    { id: '0.1', docs: ['W-9', 'EIN', 'Entity Articles of Incorporation'] },
    { id: '0.2', docs: ['Foreign Entity Registration', 'SDAT Registration', 'Entity Good Standing Certificate'] }
  ]},
  { id: '1', label: 'Real Estate', subs: [
    { id: '1.1', docs: ['Letter of Intent', 'Executed Lease Agreement', 'Memorandum of Lease (Recorded)', 'Property Owner Articles of Incorporation', 'Property Owner Operating Agreement', 'Property Card', 'Property Owner Good Standing Certificate', 'KMZ'] },
    { id: '1.2', docs: ['Title Report', 'Title Commitment', 'Deed', 'Deed Exception', 'SNDA', 'Parcel Map'] },
    { id: '1.3', docs: ['ALTA Survey'] }
  ]},
  { id: '2', label: 'Engineering', subs: [
    { id: '2.1', docs: ['Preliminary IE Report', 'IE Roof Report - Core Sample Testing Report'] },
    { id: '2.2', docs: ['Preliminary Single Line Diagram', '30% Electrical Engineering', 'Helioscope Report', 'Shading Analysis', 'Proposed Equipment Specifications', 'Final PVSyst Analysis', 'Utility Engineering Drawings'] },
    { id: '2.3', docs: ['Structural Load Analysis Basic', 'Rooftop Structural Load Analysis Final', '30% Structural Engineering', 'Issued for Construction Structural Engineering'] },
    { id: '2.4', docs: ['General Site Plan', 'Stormwater Management Report (SWPPP)', 'USGS Desktop Soil Analysis', 'Topographic Report', 'Desktop Geotechnical Report', 'Geotechnical Analysis', 'Desktop Wetlands and FEMA Analysis'] },
    { id: '2.5', docs: ['As-Built Structural Plans', 'As-Built Roof and Framing Plans', 'Roof Inspection and Survey', 'Drone Flight Imagery', 'Roof Warranties and Specifications', 'Underground Utilities Survey'] }
  ]},
  { id: '3', label: 'Permitting', subs: [
    { id: '3.1', docs: ['Desktop Zoning Report', 'Pre-Approval Zoning Letters', 'Zoning Exemption Letters'] },
    { id: '3.2', docs: ['Required Permits Matrix', 'Special Use or Conditional Use Permit', 'Property Tax Agreement and Permit', 'Building Permit', 'Electrical Permit', 'Stormwater Permit', 'Land Disturbance Permit', 'DOT Permits', 'Environmental Permits', 'Underground Utilities Permit'] }
  ]},
  { id: '4', label: 'Interconnection', subs: [
    { id: '4.1', docs: ['Pre-Application Results', 'IX Application Form', 'IX Application Fee', 'Conditional Approval', 'IX Agreement (NTP)'] }
  ]},
  { id: '5', label: 'Construction', subs: [
    { id: '5.1', docs: ['EPC Proposal and Exceptions', 'EPC Statement of Qualifications', 'EPC Contract', 'Limited Notice to Proceed', 'Payment and Performance Bonds', 'Construction Schedule', 'Construction Budget'] },
    { id: '5.2', docs: ['Module Supply Agreement', 'Electrical Equipment Quotes', 'Domestic Content Plan', 'Domestic Content Reliance Letters'] },
    { id: '5.3', docs: ['Roof Contractor Statement of Qualifications', 'Roof Contractor Proposal and Exceptions', 'Roof Contractor Contract', 'Roof Manufacturer Overburden Form'] }
  ]},
  { id: '6', label: 'Financial', subs: [
    { id: '6.1', docs: ['Property Tax Model', 'O&M Proposal', 'Financial Model', 'Tax Equity Term Sheet'] }
  ]}
]

export default async function DataroomPage() {
  const supabase = await createClient()

  type ProjectRow = { id: string; name: string; project_number: string; tranche: string; stage: string }
  type DocRow = { project_id: string; category_id: string; status: string }
  const [{ data: projects }, { data: docs }] = await Promise.all([
    supabase.from('projects').select('id, name, project_number, tranche, stage').order('name') as unknown as Promise<{data: ProjectRow[] | null}>,
    supabase.from('dataroom_docs').select('project_id, category_id, status') as unknown as Promise<{data: DocRow[] | null}>,
  ])

  // Compute per-project stats
  const totalDocsPerProject = DR_CATEGORIES.reduce((sum, cat) =>
    sum + cat.subs.reduce((s2, sub) => s2 + sub.docs.length, 0), 0)

  const projectStats = (projects ?? []).map(p => {
    const projectDocs = (docs ?? []).filter(d => d.project_id === p.id)
    const uploaded = projectDocs.filter(d => d.status === 'uploaded' || d.status === 'approved').length
    const pct = totalDocsPerProject > 0 ? Math.round((uploaded / totalDocsPerProject) * 100) : 0

    // Per-category stats
    const catStats = DR_CATEGORIES.map(cat => {
      const catTotal = cat.subs.reduce((s, sub) => s + sub.docs.length, 0)
      const catDocs = projectDocs.filter(d => d.category_id === cat.id)
      const catUploaded = catDocs.filter(d => d.status === 'uploaded' || d.status === 'approved').length
      const catPct = catTotal > 0 ? Math.round((catUploaded / catTotal) * 100) : 0
      return { id: cat.id, label: cat.label, pct: catPct, uploaded: catUploaded, total: catTotal }
    })

    return {
      id: p.id, name: p.name, project_number: p.project_number,
      tranche: p.tranche, stage: p.stage,
      uploaded, total: totalDocsPerProject, pct, catStats
    }
  })

  const globalTotal = projectStats.reduce((s, p) => s + p.total, 0)
  const globalUploaded = projectStats.reduce((s, p) => s + p.uploaded, 0)
  const globalPct = globalTotal > 0 ? Math.round((globalUploaded / globalTotal) * 100) : 0
  const fullyComplete = projectStats.filter(p => p.pct === 100).length
  const needsAttention = projectStats.filter(p => p.pct < 25).length
  const avgPct = projectStats.length > 0 ? Math.round(projectStats.reduce((s, p) => s + p.pct, 0) / projectStats.length) : 0

  const catPortfolioStats = DR_CATEGORIES.map(cat => {
    const total = (projects?.length ?? 0) * cat.subs.reduce((s, sub) => s + sub.docs.length, 0)
    const uploaded = (docs ?? []).filter(d => d.category_id === cat.id && (d.status === 'uploaded' || d.status === 'approved')).length
    const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0
    return { id: cat.id, label: cat.label, pct, uploaded, total }
  })

  return <DataroomClient projectStats={projectStats} globalPct={globalPct} globalUploaded={globalUploaded}
    globalTotal={globalTotal} fullyComplete={fullyComplete} needsAttention={needsAttention}
    avgPct={avgPct} catPortfolioStats={catPortfolioStats} categories={DR_CATEGORIES.map(c => ({ id: c.id, label: c.label }))} />
}
