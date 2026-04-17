import Link from 'next/link'
import { Zap, MapPin } from 'lucide-react'
import { StageBadge } from '@/components/ui/StageBadge'
import { DealHealthBadge } from '@/components/ui/DealHealthBadge'
import { Avatar } from '@/components/ui/Avatar'

interface ProjectCardProps {
  project: {
    id: string
    project_number: string
    name: string
    stage: string
    deal_health: string
    system_kwdc: number
    city: string
    state: string
    assignee_name?: string
    next_milestone?: string
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const kwdc = project.system_kwdc
  const sizeLabel = kwdc >= 1000 ? `${(kwdc / 1000).toFixed(2)} MWdc` : `${kwdc} kWdc`

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-mono text-[10px] text-[#94a3b8] mb-0.5">{project.project_number}</p>
            <h3 className="font-semibold text-[#2F3E50] text-sm leading-tight">{project.name}</h3>
          </div>
          <DealHealthBadge health={project.deal_health} />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <StageBadge stage={project.stage} />
        </div>

        <div className="flex items-center gap-4 text-xs text-[#6E879E] mb-3">
          <span className="flex items-center gap-1">
            <Zap size={12} className="text-[#E6C87A]" />
            {sizeLabel}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {project.city}, {project.state}
          </span>
        </div>

        <div className="flex items-center justify-between">
          {project.assignee_name && (
            <Avatar name={project.assignee_name} size="sm" />
          )}
          {project.next_milestone && (
            <p className="text-[10px] text-[#94a3b8] truncate max-w-[160px]">{project.next_milestone}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
