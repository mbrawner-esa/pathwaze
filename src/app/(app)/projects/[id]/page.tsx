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
import {
  nextMilestoneDetail, rollUpMajor, majorsFor, suggestDealHealth,
  WORKSTREAMS, WORKSTREAM_LABELS,
  type MajorDef, type Milestone,
} from '@/lib/workstreams'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await Promise.all([
    supabase.from('projects').select('*, users!assignee_id(full_name, avatar_url)').eq('id', id).single(),
    supabase.from('project_financials').select('*').eq('project_id', id).single(),
    // Workstreams (migration 054) replaces the legacy `milestones` table.
    // Majors are catalog rows with no per-project row — their window and status
    // are derived from the subs at read time.
    supabase.from('workstream_majors').select('*').order('workstream').order('sort_order'),
    supabase.from('stakeholders').select('*').eq('project_id', id),
    supabase.from('permits').select('*').eq('project_id', id),
    supabase.from('dataroom_docs').select('*').eq('project_id', id),
    supabase.from('users').select('id, full_name, avatar_url, slack_user_id').eq('status', 'active').order('full_name'),
    supabase.from('buildings').select('*').eq('project_id', id).order('created_at'),
    supabase.from('meters').select('*').eq('project_id', id).order('created_at'),
    supabase.from('systems').select('*, system_buildings(building_id)').eq('project_id', id).order('created_at'),
    supabase.from('project_threads').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('project_notes').select('*, user:users(full_name, avatar_url)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('offtaker_pricing').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('tasks').select('id, title, type, status, priority, due_date, assignee:users!assignee_id(id, full_name, avatar_url)').eq('project_id', id).is('parent_task_id', null).order('created_at', { ascending: false }),
    supabase.from('workstream_milestones').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('workstream_gates').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('workstream_major_state').select('*').eq('project_id', id),
    supabase.from('workstream_updates').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    // Tasks linked to a milestone — the work under it. Separate from the Tasks
    // tab query, which excludes subtasks and carries different columns.
    supabase.from('tasks')
      .select('id, title, status, assignee_id, due_date, completed_at, workstream_milestone_id')
      .eq('project_id', id).not('workstream_milestone_id', 'is', null),
  ]) as unknown as [any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any]
  const [
    { data: project }, { data: financials }, { data: wsDefs },
    { data: stakeholders }, { data: permits }, { data: docs }, { data: users },
    { data: buildings }, { data: meters }, { data: systems },
    { data: threads }, { data: notes },
    { data: pricingRows }, { data: tasks },
    { data: wsMilestones }, { data: wsGates }, { data: wsMajorState },
    { data: wsUpdates }, { data: wsTasks },
  ] = results

  if (!project) notFound()

  // Flatten the system_buildings join into a building_ids array on each system
  // (the many-to-many "linked areas"). building_id stays as the primary area.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const systemsWithAreas = ((systems ?? []) as any[]).map(s => ({
    ...s,
    building_ids: Array.isArray(s.system_buildings)
      ? s.system_buildings.map((j: { building_id: string }) => j.building_id)
      : [],
  }))

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
      entity_type: a.entity_type, entity_id: a.entity_id, action: a.action, metadata: a.metadata,
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
      note_type: n.type, title: n.title, body: n.body, category: n.category ?? null,
      event_date: n.event_date, file_name: n.file_name,
      user_name: n.user?.full_name ?? null,
      user_avatar_url: n.user?.avatar_url ?? null,
      created_at: n.created_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  // Permit attachment counts. Deliberately a separate query rather than a
  // nested select on `permits`: PostgREST fails the whole permits read if the
  // relation is absent, which would silently empty the Permitting tab on a DB
  // where migration 065 has not been run yet. This way the counts degrade to
  // zero and the permits still list.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const permitIds = ((permits ?? []) as any[]).map(pm => pm.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let permitsWithFiles: any[] = permits ?? []
  if (permitIds.length) {
    const { data: permitFiles } = await supabase
      .from('permit_attachments')
      .select('id, permit_id')
      .in('permit_id', permitIds) as { data: Array<{ id: string; permit_id: string }> | null }
    if (permitFiles) {
      const countByPermit: Record<string, { id: string }[]> = {}
      for (const f of permitFiles) {
        (countByPermit[f.permit_id] ??= []).push({ id: f.id })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      permitsWithFiles = ((permits ?? []) as any[]).map(pm => ({
        ...pm, permit_attachments: countByPermit[pm.id] ?? [],
      }))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const milestoneIds = ((wsMilestones ?? []) as any[]).map(m => m.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wsDeps: any[] = []
  if (milestoneIds.length) {
    // Edges are scoped by milestone id rather than project id (the table has no
    // project column — both ends are guaranteed same-project by trigger).
    const { data } = await supabase
      .from('workstream_milestone_deps')
      .select('milestone_id, depends_on')
      .in('milestone_id', milestoneIds) as { data: any[] | null }
    wsDeps = data ?? []
  }

  // Exit-gate → milestone links. Scoped by gate id because the link table has
  // no project column, same as the dependency edges.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gateIds = ((wsGates ?? []) as any[]).map(g => g.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wsGateLinks: any[] = []
  if (gateIds.length) {
    const { data } = await supabase
      .from('workstream_gate_links')
      .select('gate_id, milestone_id')
      .in('gate_id', gateIds) as { data: any[] | null }
    wsGateLinks = data ?? []
  }

  // Workstream events for the weekly-update thread. Fetched separately from the
  // page-wide activity feed because that one is capped at 100 rows across every
  // entity type, which a busy project would exhaust before reaching these.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wsActivity } = await supabase
    .from('activity_log')
    .select('id, action, created_at, user_id, metadata')
    .eq('entity_type', 'workstream_milestone')
    .eq('metadata->>project_id', id)
    .order('created_at', { ascending: false })
    .limit(200) as any

  const assigneeName = project.users?.full_name ?? null
  const assigneeAvatarUrl = project.users?.avatar_url ?? null
  // "Next Milestone" now derives from Workstreams, not the retired `milestones`
  // table — see ROADMAP Appendix A req. 11.
  // The next actual deliverable, not the major it sits under — "LNTP CFO
  // Approval" is a task someone owns; "Term Sheet" is a chapter heading.
  const nextDetail = nextMilestoneDetail(
    (wsDefs ?? []) as MajorDef[],
    (wsMilestones ?? []) as Milestone[],
    wsMajorState ?? [],
  )
  const nextMilestoneView = nextDetail
    ? {
        label: nextDetail.milestone.label,
        target_date: nextDetail.milestone.end_date,
        majorLabel: nextDetail.majorLabel,
        workstreamLabel: WORKSTREAM_LABELS[nextDetail.workstream],
      }
    : undefined

  // Active Workstreams for the summary card: the major currently in flight in
  // each workstream. Shows where the project actually is right now, which the
  // single manual Development Stage field could never express — three
  // workstreams move independently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overrideByKey = new Map(((wsMajorState ?? []) as any[]).map(s => [s.major_key, s.completed_at ?? null]))
  // Every major's roll-up, used both for the Active Workstreams chips and for
  // the deal-health signal below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allRollups = ((wsDefs ?? []) as MajorDef[]).map(d =>
    rollUpMajor(d, (wsMilestones ?? []) as Milestone[], undefined,
      (((wsMajorState ?? []) as any[]).find(s => s.major_key === d.key)?.completed_at) ?? null))
  const healthSignal = suggestDealHealth(allRollups)

  const activeWorkstreams = WORKSTREAMS.flatMap(ws => {
    const rollups = majorsFor((wsDefs ?? []) as MajorDef[], ws)
      .map(d => rollUpMajor(d, (wsMilestones ?? []) as Milestone[], undefined, overrideByKey.get(d.key) ?? null))
    // At-risk outranks active: if something in this workstream is in trouble,
    // that is the one worth surfacing on the summary.
    const pick = rollups.find(r => r.status === 'at_risk') ?? rollups.find(r => r.status === 'active')
    if (!pick) return []
    return [{
      key: pick.key,
      label: pick.label,
      workstreamLabel: WORKSTREAM_LABELS[ws],
      pct: pick.pct,
      status: pick.status,
    }]
  })
  const lastUpdated = formatDate(new Date().toISOString())

  // Fetch current user's role for admin-gated actions
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = 'team'
  if (user) {
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single() as { data: { role?: string } | null }
    userRole = me?.role ?? 'team'
  }

  // Drawings tab: drawings (with area + review) + the As-Built action plan's sections (with item counts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: drawingsRaw } = await supabase
    .from('drawings')
    .select('*, area:buildings(id, name, category), review:drawing_reviews(id, status, reviewer_id, due_date), drawing_disciplines(discipline_key), drawing_systems(system_id), uploader:users!uploaded_by(id, full_name)')
    .eq('project_id', id)
    .order('uploaded_at', { ascending: false }) as any

  // Flatten the drawing_disciplines join into a discipline_keys array on each drawing
  // (the many-to-many disciplines). discipline_key stays as the primary discipline.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drawings = ((drawingsRaw ?? []) as any[]).map(d => ({
    ...d,
    discipline_keys: Array.isArray(d.drawing_disciplines)
      ? d.drawing_disciplines.map((j: { discipline_key: string }) => j.discipline_key)
      : [],
    system_ids: Array.isArray(d.drawing_systems)
      ? d.drawing_systems.map((j: { system_id: string }) => j.system_id)
      : [],
  }))

  // Drawing collections (with owner) + each collection's action-plan sections (with item counts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collectionsRaw } = await supabase
    .from('drawing_collections')
    .select('*, owner:users!owner_id(id, full_name, avatar_url)')
    .eq('is_active', true)
    .order('sort_order') as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planIds = Array.from(new Set(((collectionsRaw ?? []) as any[]).map(c => c.action_plan_id).filter(Boolean)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sectionsByPlan: Record<string, any[]> = {}
  if (planIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: secs } = await supabase
      .from('action_plan_sections')
      .select('action_plan_id, key, label, is_universal, sort_order, items:action_plan_items(count)')
      .in('action_plan_id', planIds)
      .order('sort_order') as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (secs ?? []) as any[]) {
      ;(sectionsByPlan[s.action_plan_id] ??= []).push({
        key: s.key, label: s.label, is_universal: s.is_universal,
        item_count: Array.isArray(s.items) ? (s.items[0]?.count ?? 0) : 0,
      })
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections = ((collectionsRaw ?? []) as any[]).map(c => ({
    ...c, sections: c.action_plan_id ? (sectionsByPlan[c.action_plan_id] ?? []) : [],
  }))

  // Site plans = drawings belonging to a collection whose link_target is 'system'
  // (the seeded 'Site Plans' collection). Derived here so the Technical tab can
  // render them read-only without knowing about collections.
  const sitePlanCollectionIds = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((collectionsRaw ?? []) as any[]).filter(c => c.link_target === 'system').map(c => c.id),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sitePlans = (drawings as any[])
    .filter(d => d.collection_id && sitePlanCollectionIds.has(d.collection_id))
    .map(d => ({
      id: d.id,
      file_name: d.file_name,
      set_label: d.set_label ?? null,
      storage_path: d.storage_path ?? null,
      uploaded_at: d.uploaded_at,
      uploaded_by_name: d.uploader?.full_name ?? null,
      system_ids: d.system_ids ?? [],
    }))

  // Review types = available action plans (drives the "Select review type" dropdown).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reviewTypesRaw } = await supabase
    .from('action_plans').select('id, name').eq('is_active', true).order('name') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviewTypes = ((reviewTypesRaw ?? []) as any[]).map(p => ({ id: p.id, name: p.name }))

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
          <EditableDealHealth
            projectId={project.id}
            initial={project.deal_health}
            suggestion={{ value: healthSignal.value, reason: healthSignal.reason }}
            overridden={!!project.deal_health_override}
          />
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
          nextMilestone={nextMilestoneView}
          activeWorkstreams={activeWorkstreams}
          lastUpdated={lastUpdated}
          users={users ?? []}
        />
      </div>

      <ProjectDetailClient
        project={project}
        financials={financials}
        wsDefs={wsDefs ?? []}
        wsMilestones={wsMilestones ?? []}
        wsDeps={wsDeps}
        wsGates={wsGates ?? []}
        wsMajorState={wsMajorState ?? []}
        wsUpdates={wsUpdates ?? []}
        wsTasks={wsTasks ?? []}
        wsActivity={wsActivity ?? []}
        wsGateLinks={wsGateLinks}
        userRole={userRole}
        stakeholders={stakeholders ?? []}
        permits={permitsWithFiles}
        docs={docs ?? []}
        buildings={buildings ?? []}
        meters={meters ?? []}
        systems={systemsWithAreas}
        threads={threads ?? []}
        notes={notes ?? []}
        tasks={tasks ?? []}
        activity={activity}
        users={users ?? []}
        pricingRows={pricingRows ?? []}
        drawings={drawings ?? []}
        collections={collections}
        reviewTypes={reviewTypes}
        sitePlans={sitePlans}
      />
    </div>
  )
}
