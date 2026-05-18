import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProjectDetailClient } from '@/components/project/ProjectDetailClient'
import { EditableDealHealth } from '@/components/project/EditableDealHealth'
import { ProjectSummaryCard } from '@/components/project/ProjectSummaryCard'
import { formatDate } from '@/lib/utils'

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
    supabase.from('users').select('id, full_name').order('full_name'),
    supabase.from('buildings').select('*').eq('project_id', id).order('created_at'),
    supabase.from('meters').select('*').eq('project_id', id).order('created_at'),
    supabase.from('systems').select('*').eq('project_id', id).order('created_at'),
  ]) as unknown as [any, any, any, any, any, any, any, any, any, any]
  const [
    { data: project }, { data: financials }, { data: milestones },
    { data: stakeholders }, { data: permits }, { data: docs }, { data: users },
    { data: buildings }, { data: meters }, { data: systems },
  ] = results

  if (!project) notFound()

  const assigneeName = project.users?.full_name ?? null
  const nextMilestone = (milestones ?? []).find((m: any) => !m.completed)
  const lastUpdated = formatDate(new Date().toISOString())

  return (
    <div>
      {/* Sticky breadcrumb bar */}
      <div className="bg-white border-b border-[#e2e8f0] px-8 py-3.5 flex items-center gap-3 sticky top-[52px] z-30">
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold text-[#3E3E3C] bg-white border border-[#e2e8f0] rounded hover:bg-[#fafbfc] transition-colors"
        >
          <ArrowLeft size={12} /> Projects
        </Link>
        <span className="text-[#A8A8A8]">|</span>
        <span className="text-[14px] font-semibold text-[#181818]">{project.name}</span>
        {project.project_number && (
          <span className="text-[11.5px] font-medium text-[#706E6B]">({project.project_number})</span>
        )}
        <EditableDealHealth projectId={project.id} initial={project.deal_health} />
      </div>

      {/* Map + Summary card */}
      <div className="px-8 pt-7 grid gap-6" style={{ gridTemplateColumns: '30% 1fr' }}>
        <div className="rounded-xl overflow-hidden bg-[#1a2332] relative">
          {project.lat && project.lng ? (
            <iframe
              title="Site Map"
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block', width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              src={`https://www.google.com/maps?q=${project.lat},${project.lng}&z=17&t=k&output=embed`}
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[13px] text-[#706E6B] p-6 text-center">
              No coordinates available
            </div>
          )}
        </div>

        <ProjectSummaryCard
          project={project}
          assigneeName={assigneeName}
          nextMilestone={nextMilestone}
          lastUpdated={lastUpdated}
          users={users ?? []}
        />
      </div>

      <ProjectDetailClient
        project={project}
        financials={financials}
        milestones={milestones ?? []}
        stakeholders={stakeholders ?? []}
        permits={permits ?? []}
        docs={docs ?? []}
        buildings={buildings ?? []}
        meters={meters ?? []}
        systems={systems ?? []}
      />
    </div>
  )
}
