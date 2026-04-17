import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { PipelineChart } from '@/components/dashboard/PipelineChart'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'

export default async function DashboardPage() {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: projects }, { data: tasks }, { data: docs }, { data: activity }] = await Promise.all([
    supabase.from('projects').select('id, stage, system_kwdc').order('name') as unknown as Promise<{data: {id:string;stage:string;system_kwdc:number}[] | null}>,
    supabase.from('tasks').select('id, status') as unknown as Promise<{data: {id:string;status:string}[] | null}>,
    supabase.from('dataroom_docs').select('id, status') as unknown as Promise<{data: {id:string;status:string}[] | null}>,
    supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20) as unknown as Promise<{data: any[] | null}>,
  ])

  const { data: financials } = await supabase.from('project_financials').select('total_cost') as unknown as {data: {total_cost: number}[] | null}

  const totalProjects = projects?.length ?? 0
  const totalMwdc = (projects ?? []).reduce((sum, p) => sum + (p.system_kwdc ?? 0), 0)
  const totalValue = (financials ?? []).reduce((sum, f) => sum + (f.total_cost ?? 0), 0)
  const openTasks = (tasks ?? []).filter(t => t.status !== 'Complete').length
  const totalDocs = (docs ?? []).length
  const uploadedDocs = (docs ?? []).filter(d => d.status === 'uploaded' || d.status === 'approved').length
  const drCompletion = totalDocs > 0 ? Math.round((uploadedDocs / totalDocs) * 100) : 0

  const STAGES = ['Prospecting', 'Proposal', 'Contracting', 'Permitting', 'Construction', 'Operations']
  const stageCounts: Record<string, number> = {}
  STAGES.forEach(s => { stageCounts[s] = 0 })
  ;(projects ?? []).forEach(p => { if (stageCounts[p.stage] !== undefined) stageCounts[p.stage]++ })
  const pipelineData = STAGES.map(stage => ({ stage, count: stageCounts[stage] ?? 0 }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#2F3E50]">Portfolio Dashboard</h1>
        <p className="text-[#6E879E] text-sm mt-1">AdventHealth BTM Solar — {totalProjects} projects</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Projects" value={`${totalProjects}`} sub={`${(totalMwdc / 1000).toFixed(1)} MWdc`} color="#2F3E50" />
        <KpiCard label="Portfolio Value" value={formatCurrency(totalValue)} sub="Estimated total cost" color="#E6C87A" />
        <KpiCard label="Open Tasks" value={`${openTasks}`} sub="Across all projects" color="#6E879E" />
        <KpiCard label="Dataroom Completion" value={`${drCompletion}%`} sub={`${uploadedDocs} / ${totalDocs} docs`} color="#7FA766" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card p-6">
          <h2 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Pipeline by Stage</h2>
          <PipelineChart data={pipelineData} />
        </div>
        <div className="card p-6">
          <h2 className="text-sm font-bold text-[#2F3E50] mb-4 uppercase tracking-wider">Recent Activity</h2>
          <ActivityFeed items={activity ?? []} />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card p-5">
      <p className="label mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs text-[#6E879E] mt-1">{sub}</p>
    </div>
  )
}
