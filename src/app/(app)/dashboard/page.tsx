import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { StageBadge } from '@/components/ui/StageBadge'

// ── Week helpers (Mon–Sun) ──
function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  s.setDate(s.getDate() + 6)
  s.setHours(23, 59, 59, 999)
  return s
}

const PRIORITY_COLOR: Record<string, string> = { High: '#ef4444', Medium: '#f59e0b', Low: '#94a3b8' }
const TYPE_BG: Record<string, { bg: string; text: string }> = {
  Design: { bg: '#EEF2FF', text: '#3730A3' },
  Engineering: { bg: '#DBEAFE', text: '#1E40AF' },
  Permitting: { bg: '#FEF3C7', text: '#92400E' },
  Interconnection: { bg: '#D1FAE5', text: '#047857' },
  Financial: { bg: '#FCE7F3', text: '#9D174D' },
  Legal: { bg: '#E0E7FF', text: '#4338CA' },
  Construction: { bg: '#FFEDD5', text: '#9A3412' },
  Operations: { bg: '#F1F5F9', text: '#475569' },
  Administrative: { bg: '#F3F4F6', text: '#374151' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Pull profile for full name (falls back to email)
  const { data: profile } = await supabase.from('users').select('full_name').eq('id', user.id).single() as { data: { full_name?: string } | null }
  const fullName = profile?.full_name || user.email?.split('@')[0] || 'there'
  const firstName = fullName.split(' ')[0]

  const now = new Date()
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const weekStartIso = weekStart.toISOString().slice(0, 10)
  const weekEndIso = weekEnd.toISOString().slice(0, 10)

  // ─── Parallel data fetch ───────────────────────────────────────
  const [
    { data: tasksDueThisWeek },
    { data: completedActivity },
    { data: myThreadEntries },
    { data: recentActivity },
  ] = await Promise.all([
    // Tasks due this week (mine, not complete)
    supabase
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('id, title, status, priority, due_date, type, project_id, project:projects(name)') as any,
    // Activity log: my Complete transitions in last 7 days
    supabase
      .from('activity_log')
      .select('id, entity_id, created_at, metadata')
      .eq('user_id', user.id)
      .eq('entity_type', 'task')
      .eq('action', 'status_changed')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false }),
    // task_threads I posted to recently
    supabase
      .from('task_threads')
      .select('id, task_id, message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    // Activity log for active-projects ranking (last 30 days)
    supabase
      .from('activity_log')
      .select('id, entity_type, entity_id, created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  // Filter tasks client-side (assignee = me AND due_date in week range AND not Complete)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myDueThisWeek = ((tasksDueThisWeek ?? []) as any[]).filter(t =>
    t.assignee_id === user.id &&
    t.status !== 'Complete' &&
    t.due_date &&
    t.due_date >= weekStartIso &&
    t.due_date <= weekEndIso
  ).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))

  // Resolve completed-task details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedTaskIds: string[] = ((completedActivity ?? []) as any[])
    .filter(a => a.metadata?.to === 'Complete')
    .map(a => a.entity_id)
  const { data: completedTasks } = completedTaskIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, title, type, priority, project:projects(name)')
        .in('id', completedTaskIds) as unknown as { data: any[] | null }
    : { data: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const completedById = new Map<string, any>((completedTasks ?? []).map(t => [t.id, t]))
  // Deduplicate by task — keep most recent completion per task
  const seenTask = new Set<string>()
  const myCompletedLastWeek: { task: any; completedAt: string }[] = []
  for (const a of ((completedActivity ?? []) as any[])) {
    if (a.metadata?.to !== 'Complete' || seenTask.has(a.entity_id)) continue
    const task = completedById.get(a.entity_id)
    if (!task) continue
    seenTask.add(a.entity_id)
    myCompletedLastWeek.push({ task, completedAt: a.created_at })
  }

  // Top conversations: most recent task threads I posted to (dedup per task)
  const seenThreadTask = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myRecentThreads: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of ((myThreadEntries ?? []) as any[])) {
    if (seenThreadTask.has(t.task_id)) continue
    seenThreadTask.add(t.task_id)
    myRecentThreads.push(t)
    if (myRecentThreads.length >= 5) break
  }
  // Resolve task + project info for each
  const threadTaskIds = myRecentThreads.map(t => t.task_id)
  const { data: threadTasks } = threadTaskIds.length > 0
    ? await supabase
        .from('tasks')
        .select('id, title, project:projects(name)')
        .in('id', threadTaskIds) as unknown as { data: any[] | null }
    : { data: [] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const threadTaskMap = new Map<string, any>((threadTasks ?? []).map(t => [t.id, t]))

  // Active projects: aggregate activity_log by project_id (via task/stakeholder linkage)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recent = (recentActivity ?? []) as any[]
  const taskActivityIds = Array.from(new Set(recent.filter(a => a.entity_type === 'task').map(a => a.entity_id as string)))
  const stkActivityIds  = Array.from(new Set(recent.filter(a => a.entity_type === 'stakeholder').map(a => a.entity_id as string)))
  const [{ data: taskLookup }, { data: stkLookup }] = await Promise.all([
    taskActivityIds.length > 0
      ? supabase.from('tasks').select('id, project_id').in('id', taskActivityIds) as unknown as Promise<{ data: any[] | null }>
      : Promise.resolve({ data: [] as any[] }),
    stkActivityIds.length > 0
      ? supabase.from('stakeholders').select('id, project_id').in('id', stkActivityIds) as unknown as Promise<{ data: any[] | null }>
      : Promise.resolve({ data: [] as any[] }),
  ])
  const entityToProject = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(taskLookup ?? []).forEach((t: any) => t.project_id && entityToProject.set(t.id, t.project_id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(stkLookup ?? []).forEach((s: any) => s.project_id && entityToProject.set(s.id, s.project_id))

  const projectStats: Record<string, { count: number; last: string }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;((recentActivity ?? []) as any[]).forEach(a => {
    const pid = entityToProject.get(a.entity_id)
    if (!pid) return
    if (!projectStats[pid]) projectStats[pid] = { count: 0, last: a.created_at }
    projectStats[pid].count++
    if (a.created_at > projectStats[pid].last) projectStats[pid].last = a.created_at
  })
  const topProjectIds = Object.entries(projectStats)
    .sort((a, b) => b[1].last.localeCompare(a[1].last))
    .slice(0, 5)
    .map(([id]) => id)
  const { data: topProjects } = topProjectIds.length > 0
    ? await supabase
        .from('projects')
        .select('id, name, project_number, stage, city, state, system_kwdc')
        .in('id', topProjectIds) as unknown as { data: any[] | null }
    : { data: [] }
  // Sort topProjects to match topProjectIds order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topProjectsOrdered = topProjectIds.map(id => (topProjects ?? []).find((p: any) => p.id === id)).filter(Boolean) as any[]

  return (
    <div className="px-8 py-10">
      {/* Greeting */}
      <div className="mb-10">
        <p className="text-[13px] font-medium text-[#706E6B] mb-1.5">{today}</p>
        <h1 className="text-[40px] font-bold tracking-tight text-[#181818] leading-tight">
          Hi {firstName} <span className="inline-block ml-1">👋</span>
        </h1>
        <p className="text-[15px] text-[#3E3E3C] mt-2">
          Here&apos;s what&apos;s on your plate this week.
        </p>
      </div>

      {/* 2×2 grid — all four cards share the same dimensions */}
      <div className="grid grid-cols-2 auto-rows-fr gap-6">
          {/* Tasks due this week */}
          <section className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[420px]">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#f1f5f9]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#181818]">Due this week</h2>
                <p className="text-[12px] text-[#706E6B] mt-0.5">{myDueThisWeek.length} {myDueThisWeek.length === 1 ? 'task' : 'tasks'} assigned to you</p>
              </div>
              <Link href="/tasks" className="text-[12px] font-medium text-[#2C5485] hover:underline">View all →</Link>
            </div>
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              {myDueThisWeek.length === 0 ? (
                <EmptyState text="No tasks due this week." />
              ) : (
                myDueThisWeek.slice(0, 6).map((t) => {
                  const tc = TYPE_BG[t.type] ?? TYPE_BG['Administrative']
                  return (
                    <Link key={t.id} href="/tasks" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#fafbfc] transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_COLOR[t.priority] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#181818] truncate">{t.title}</p>
                        <p className="text-[11.5px] text-[#706E6B] truncate">{t.project?.name ?? 'No project'}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: tc.bg, color: tc.text }}>{t.type}</span>
                      <span className="text-[11.5px] text-[#706E6B] flex-shrink-0 w-[60px] text-right">{formatDate(t.due_date)}</span>
                    </Link>
                  )
                })
              )}
            </div>
          </section>

          {/* Active projects */}
          <section className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[420px]">
            <div className="px-6 py-4 flex items-center justify-between border-b border-[#f1f5f9]">
              <div>
                <h2 className="text-[15px] font-semibold text-[#181818]">Active projects</h2>
                <p className="text-[12px] text-[#706E6B] mt-0.5">Most activity in the last 30 days</p>
              </div>
              <Link href="/projects" className="text-[12px] font-medium text-[#2C5485] hover:underline">View all →</Link>
            </div>
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              {topProjectsOrdered.length === 0 ? (
                <EmptyState text="No recent project activity." />
              ) : (
                topProjectsOrdered.slice(0, 5).map(p => {
                  const stats = projectStats[p.id]
                  const kw = (p.system_kwdc ?? 0).toLocaleString()
                  return (
                    <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#fafbfc] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#181818] truncate">{p.name}</p>
                        <p className="text-[11.5px] text-[#706E6B] truncate">{p.city}, {p.state} · {kw} kWdc</p>
                      </div>
                      <StageBadge stage={p.stage} />
                      <div className="flex-shrink-0 text-right">
                        <p className="text-[11.5px] font-semibold text-[#181818]">{stats.count}</p>
                        <p className="text-[10px] text-[#706E6B]">events</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </section>

          {/* Completed last week */}
          <section className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[420px]">
            <div className="px-6 py-4 border-b border-[#f1f5f9]">
              <h2 className="text-[15px] font-semibold text-[#181818]">Completed in the last 7 days</h2>
              <p className="text-[12px] text-[#706E6B] mt-0.5">{myCompletedLastWeek.length} {myCompletedLastWeek.length === 1 ? 'task' : 'tasks'}</p>
            </div>
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              {myCompletedLastWeek.length === 0 ? (
                <EmptyState text="Nothing completed in the last 7 days." />
              ) : (
                myCompletedLastWeek.slice(0, 6).map(({ task, completedAt }) => {
                  const tc = TYPE_BG[task.type] ?? TYPE_BG['Administrative']
                  return (
                    <Link key={task.id} href="/tasks" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#fafbfc] transition-colors">
                      <span className="w-4 h-4 rounded-full bg-[#D1FAE5] flex items-center justify-center flex-shrink-0">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#181818] truncate">{task.title}</p>
                        <p className="text-[11.5px] text-[#706E6B] truncate">{task.project?.name ?? 'No project'}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: tc.bg, color: tc.text }}>{task.type}</span>
                      <span className="text-[11.5px] text-[#706E6B] flex-shrink-0 w-[60px] text-right">{formatDate(completedAt)}</span>
                    </Link>
                  )
                })
              )}
            </div>
          </section>

          {/* Conversations */}
          <section className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden flex flex-col min-h-[420px]">
            <div className="px-6 py-4 border-b border-[#f1f5f9]">
              <h2 className="text-[15px] font-semibold text-[#181818]">Your conversations</h2>
              <p className="text-[12px] text-[#706E6B] mt-0.5">Threads you&apos;ve posted in recently</p>
            </div>
            <div className="px-2 py-1 flex-1 overflow-y-auto">
              {myRecentThreads.length === 0 ? (
                <EmptyState text="No recent messages. Drop a thought in a task thread to start." />
              ) : (
                myRecentThreads.map(t => {
                  const task = threadTaskMap.get(t.task_id)
                  if (!task) return null
                  return (
                    <Link key={t.id} href="/tasks" className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-[#fafbfc] transition-colors">
                      <Avatar name={fullName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-[#181818] truncate">{task.title}</p>
                        <p className="text-[12px] text-[#3E3E3C] line-clamp-1 mt-0.5">&ldquo;{t.message}&rdquo;</p>
                        <p className="text-[10.5px] text-[#706E6B] mt-1">
                          {task.project?.name ?? 'No project'} · {formatDate(t.created_at)}
                        </p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </section>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-6 py-10 text-center text-[12.5px] text-[#706E6B]">{text}</div>
  )
}
