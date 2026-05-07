import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StageBadge } from '@/components/ui/StageBadge'
import { DealHealthBadge } from '@/components/ui/DealHealthBadge'
import { Avatar } from '@/components/ui/Avatar'
import { ProjectDetailClient } from '@/components/project/ProjectDetailClient'
import { formatNumber } from '@/lib/utils'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await Promise.all([
    supabase.from('projects').select('*, users!assignee_id(full_name)').eq('id', id).single(),
    supabase.from('project_financials').select('*').eq('project_id', id).single(),
    supabase.from('milestones').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('stakeholders').select('*').eq('project_id', id),
    supabase.from('permits').select('*').eq('project_id', id),
    supabase.from('dataroom_docs').select('*').eq('project_id', id),
  ]) as unknown as [any, any, any, any, any, any]
  const [{ data: project }, { data: financials }, { data: milestones }, { data: stakeholders }, { data: permits }, { data: docs }] = results

  if (!project) notFound()

  const assigneeName = project.users?.full_name ?? null
  const nextMilestone = (milestones ?? []).find((m: any) => !m.completed)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Link href="/projects" className="mt-1 text-[#6E879E] hover:text-[#2F3E50] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="font-mono text-xs text-[#94a3b8] mb-1">{project.project_number}</p>
            <h1 className="text-2xl font-bold text-[#2F3E50]">{project.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <StageBadge stage={project.stage} />
              <DealHealthBadge health={project.deal_health} />
            </div>
          </div>
        </div>
      </div>

      {/* Map + Summary Row */}
      <div className="flex gap-4 mb-6">
        {project.lat && project.lng && (
          <div className="rounded-xl overflow-hidden border border-[#f1f5f9] flex-shrink-0" style={{ width: 280 }}>
            <iframe
              title="Site Map"
              width="280"
              height="180"
              style={{ border: 0, display: 'block' }}
              src={`https://maps.google.com/maps?q=${project.lat},${project.lng}&z=15&t=k&output=embed`}
              allowFullScreen
            />
          </div>
        )}
        <div className="card p-5 flex-1">
          <h3 className="label mb-3">Project Summary</h3>
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <p className="label mb-0.5">System Size</p>
              <p className="text-sm font-semibold text-[#2F3E50]">{formatNumber(project.system_kwdc)} kWdc</p>
            </div>
            <div>
              <p className="label mb-0.5">Stage</p>
              <p className="text-sm text-[#334155]">{project.stage}</p>
            </div>
            <div>
              <p className="label mb-0.5">Tranche</p>
              <p className="text-sm text-[#334155]">{project.tranche}</p>
            </div>
            <div>
              <p className="label mb-0.5">Location</p>
              <p className="text-sm text-[#334155]">{project.city}, {project.state}</p>
            </div>
            <div>
              <p className="label mb-0.5">Assignee</p>
              {assigneeName ? (
                <div className="flex items-center gap-1.5">
                  <Avatar name={assigneeName} size="sm" />
                  <span className="text-sm text-[#334155]">{assigneeName}</span>
                </div>
              ) : <p className="text-sm text-[#94a3b8]">—</p>}
            </div>
            <div>
              <p className="label mb-0.5">Target COD</p>
              <p className="text-sm text-[#334155]">{project.target_cod ?? '—'}</p>
            </div>
            {nextMilestone && (
              <div className="col-span-3 pt-2 border-t border-[#f1f5f9]">
                <p className="label mb-0.5">Next Milestone</p>
                <p className="text-sm text-[#E6C87A] font-semibold">{nextMilestone.label}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProjectDetailClient
        project={project}
        financials={financials}
        milestones={milestones ?? []}
        stakeholders={stakeholders ?? []}
        permits={permits ?? []}
        docs={docs ?? []}
      />
    </div>
  )
}
