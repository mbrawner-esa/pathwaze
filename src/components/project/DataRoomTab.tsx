'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Upload, CheckCircle, Clock, XCircle } from 'lucide-react'

const DR_CATEGORIES = [
  {id:'0',label:'Legal Entity',subs:[
    {id:'0.1',label:'Incorporation',docs:['W-9','EIN','Entity Articles of Incorporation']},
    {id:'0.2',label:'State Registration',docs:['Foreign Entity Registration','SDAT Registration','Entity Good Standing Certificate']}
  ]},
  {id:'1',label:'Real Estate',subs:[
    {id:'1.1',label:'Site Control',docs:['Letter of Intent','Executed Lease Agreement','Memorandum of Lease (Recorded)','Property Owner Articles of Incorporation','Property Owner Operating Agreement','Property Card','Property Owner Good Standing Certificate','KMZ']},
    {id:'1.2',label:'Title',docs:['Title Report','Title Commitment','Deed','Deed Exception','SNDA','Parcel Map']},
    {id:'1.3',label:'Surveys',docs:['ALTA Survey']}
  ]},
  {id:'2',label:'Engineering',subs:[
    {id:'2.1',label:'Independent Engineering',docs:['Preliminary IE Report','IE Roof Report - Core Sample Testing Report']},
    {id:'2.2',label:'Electrical',docs:['Preliminary Single Line Diagram','30% Electrical Engineering','Helioscope Report','Shading Analysis','Proposed Equipment Specifications','Final PVSyst Analysis','Utility Engineering Drawings']},
    {id:'2.3',label:'Structural',docs:['Structural Load Analysis Basic','Rooftop Structural Load Analysis Final','30% Structural Engineering','Issued for Construction Structural Engineering']},
    {id:'2.4',label:'Civil',docs:['General Site Plan','Stormwater Management Report (SWPPP)','USGS Desktop Soil Analysis','Topographic Report','Desktop Geotechnical Report','Geotechnical Analysis','Desktop Wetlands and FEMA Analysis']},
    {id:'2.5',label:'Existing Conditions',docs:['As-Built Structural Plans','As-Built Roof and Framing Plans','Roof Inspection and Survey','Drone Flight Imagery','Roof Warranties and Specifications','Underground Utilities Survey']}
  ]},
  {id:'3',label:'Permitting',subs:[
    {id:'3.1',label:'Planning and Zoning',docs:['Desktop Zoning Report','Pre-Approval Zoning Letters','Zoning Exemption Letters']},
    {id:'3.2',label:'Permits',docs:['Required Permits Matrix','Special Use or Conditional Use Permit','Property Tax Agreement and Permit','Building Permit','Electrical Permit','Stormwater Permit','Land Disturbance Permit','DOT Permits','Environmental Permits','Underground Utilities Permit']}
  ]},
  {id:'4',label:'Interconnection',subs:[
    {id:'4.1',label:'Interconnection',docs:['Pre-Application Results','IX Application Form','IX Application Fee','Conditional Approval','IX Agreement (NTP)']}
  ]},
  {id:'5',label:'Construction',subs:[
    {id:'5.1',label:'EPC',docs:['EPC Proposal and Exceptions','EPC Statement of Qualifications','EPC Contract','Limited Notice to Proceed','Payment and Performance Bonds','Construction Schedule','Construction Budget']},
    {id:'5.2',label:'Equipment & Supply',docs:['Module Supply Agreement','Electrical Equipment Quotes','Domestic Content Plan','Domestic Content Reliance Letters']},
    {id:'5.3',label:'Roof Contractor',docs:['Roof Contractor Statement of Qualifications','Roof Contractor Proposal and Exceptions','Roof Contractor Contract','Roof Manufacturer Overburden Form']}
  ]},
  {id:'6',label:'Financial',subs:[
    {id:'6.1',label:'Financial',docs:['Property Tax Model','O&M Proposal','Financial Model','Tax Equity Term Sheet']}
  ]}
]

interface DrDoc {
  category_id: string
  subcategory_id: string
  doc_name: string
  status: string
  file_name: string | null
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'uploaded' || status === 'approved') return <CheckCircle size={14} className="text-green-500" />
  if (status === 'pending') return <Clock size={14} className="text-[#94a3b8]" />
  if (status === 'na') return <XCircle size={14} className="text-[#d1d5db]" />
  return <Clock size={14} className="text-[#94a3b8]" />
}

export function DataRoomTab({ docs, projectId }: { docs: DrDoc[]; projectId: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '0': true })

  function getDoc(catId: string, subId: string, docName: string) {
    return docs.find(d => d.category_id === catId && d.subcategory_id === subId && d.doc_name === docName)
  }

  function getCatProgress(catId: string) {
    let total = 0, done = 0
    DR_CATEGORIES.find(c => c.id === catId)?.subs.forEach(sub => {
      sub.docs.forEach(doc => {
        total++
        const d = getDoc(catId, sub.id, doc)
        if (d?.status === 'uploaded' || d?.status === 'approved') done++
      })
    })
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }

  return (
    <div className="space-y-3">
      {DR_CATEGORIES.map(cat => {
        const { total, done, pct } = getCatProgress(cat.id)
        const isOpen = expanded[cat.id]
        return (
          <div key={cat.id} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#f8fafc] transition-colors"
              onClick={() => setExpanded(prev => ({ ...prev, [cat.id]: !isOpen }))}
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-semibold text-[#2F3E50] text-sm">{cat.label}</span>
                <span className="text-xs text-[#94a3b8]">{done}/{total}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-[#6E879E] w-8 text-right">{pct}%</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-[#f1f5f9]">
                {cat.subs.map(sub => (
                  <div key={sub.id}>
                    <div className="px-5 py-2 bg-[#fafbfc]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">{sub.label}</p>
                    </div>
                    {sub.docs.map(docName => {
                      const doc = getDoc(cat.id, sub.id, docName)
                      const status = doc?.status ?? 'pending'
                      return (
                        <div key={docName} className="flex items-center justify-between px-5 py-2.5 border-t border-[#f8fafc] hover:bg-[#f8fafc]">
                          <div className="flex items-center gap-2.5">
                            <StatusIcon status={status} />
                            <span className="text-sm text-[#334155]">{docName}</span>
                            {doc?.file_name && (
                              <span className="text-xs text-[#94a3b8]">({doc.file_name})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {status === 'pending' && (
                              <button
                                className="text-xs text-[#6E879E] hover:text-[#2F3E50] flex items-center gap-1"
                                onClick={() => {
                                  const formData = new FormData()
                                  formData.append('projectId', projectId)
                                  formData.append('categoryId', cat.id)
                                  formData.append('docName', docName)
                                  // placeholder upload
                                }}
                              >
                                <Upload size={12} /> Upload
                              </button>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              status === 'uploaded' || status === 'approved' ? 'bg-green-50 text-green-700' :
                              status === 'na' ? 'bg-[#f1f5f9] text-[#94a3b8]' :
                              'bg-[#f8fafc] text-[#94a3b8]'
                            }`}>
                              {status === 'uploaded' ? 'Uploaded' : status === 'approved' ? 'Approved' : status === 'na' ? 'N/A' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
