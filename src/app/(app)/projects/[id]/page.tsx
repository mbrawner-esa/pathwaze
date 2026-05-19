import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ProjectDetailClient } from '@/components/project/ProjectDetailClient'
import { EditableDealHealth } from '@/components/project/EditableDealHealth'
import { ProjectSummaryCard } from '@/components/project/ProjectSummaryCard'
import { ProjectActionsMenu } from '@/components/project/ProjectActionsMenu'
import { formatDate } from '@/lib/utils'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await Promise.all([
    supabase.from('projects').select('*, users!assignee_id(full_name, avatar_url)').eq('id', id).single(),
    supabase.from('project_financials').select('*').eq('project_id', id).single(),
    supabase.from('milestones').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('stakeholders').select('*').eq('project_id', id),
    supabase.from('permits').select('*').eq('project_id', id),
    supabase.from('dataroom_docs').select('*').eq('project_id', id),
    supabase.from('users').select('id, full_name, avatar_url').eq('status', 'active').order('full_name'),
    supabase.from('buildings').select('*').eq('project_id', id).order('created_at'),
    supabase.from('meters').select('*').eq('project_id', id).order('created_at'),
    supabase.from('systems').select('*').eq('project_id', id).order('created_at'),
    supabase.from('project_threads').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('project_notes').select('*, user:users(full_name, avatar_url)').eq('project_id', id).order('created_at', { ascending: false }),
  ]) as unknown as [any, any, any, any, any, any, any, any, any, any, any, any]
  const [
    { data: project }, { data: financials }, { data: milestones },
    { data: stakeholders }, { data: permits }, { data: docs }, { data: users },
    { data: buildings }, { data: meters }, { data: systems },
    { data: threads }, { data: notes },
  ] = results

  if (!project) notFound()

  // Build the project activity feed:
  // - activity_log entries where entity_id = this project OR metadata.project_id = this project
  // - project_threads (each is treated as a "message" entry)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actLog } = await supabase
    .from('activity_log')
    .select('id, entity_type, entity_id, action, metadata, created_at, user_id, users(full_name, avatar_url)')
    .or(`entity_id.eq.${id},metadata->>project_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(100) as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activity = [
    ...((actLog ?? []) as any[]).map(a => ({
      id: `act-${a.id}`, kind: 'system' as const,
      entity_type: a.entity_type, action: a.action, metadata: a.metadata,
      user_name: a.users?.full_name ?? null,
      user_avatar_url: a.users?.avatar_url ?? null,
      created_at: a.created_at,
    })),
    ...((threads ?? []) as any[]).map(t => ({
      id: `thr-${t.id}`, kind: 'message' as const,
      message: t.message, user_name: t.user_name,
      user_avatar_url: t.user_avatar_url,
      created_at: t.created_at,
    })),
    ...((notes ?? []) as any[]).map(n => ({
      id: `note-${n.id}`, kind: 'note' as const,
      note_type: n.type, title: n.title, body: n.body,
      event_date: n.event_date, file_name: n.file_name,
      user_name: n.user?.full_name ?? null,
      user_avatar_url: n.user?.avatar_url ?? null,
      created_at: n.created_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const assigneeName = project.users?.full_name ?? null
  const assigneeAvatarUrl = project.users?.avatar_url ?? null
  const nextMilestone = (milestones ?? []).find((m: any) => !m.completed)
  const lastUpdated = formatDate(new Date().toISOString())

  // Fetch current user's role for admin-gated actions
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'team'
  if (user) {
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
    userRole = me?.role ?? 'team'
  }

  return (
    <div>
      {/* Sticky breadcrumb bar — full-width bg, inner content constrained */}
      <div className="bg-white border-b border-[#e2e8f0] sticky top-[52px] z-30">
        <div className="px-8 py-3.5 flex items-center gap-3 mx-auto w-full" style={{ maxWidth: 1760 }}>
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
          <div className="ml-auto">
            <ProjectActionsMenu
              projectId={project.id}
              projectName={project.name}
              slackChannelId={project.slack_channel_id ?? null}
              stage={project.stage ?? null}
              userRole={userRole}
            />
          </div>
        </div>
      </div>

      {/* Map + Summary card */}
      <div className="px-8 pt-7 grid gap-6 mx-auto w-full" style={{ gridTemplateColumns: '30% 1fr', maxWidth: 1760 }}>
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
          assigneeAvatarUrl={assigneeAvatarUrl}
          stakeholders={stakeholders ?? []}
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
        threads={threads ?? []}
        activity={activity}
        users={users ?? []}
      />
    </div>
  )
}
