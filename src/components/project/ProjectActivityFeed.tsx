'use client'
import { Avatar } from '@/components/ui/Avatar'
import { Activity, MessageSquare, Tag } from 'lucide-react'

export interface ActivityEntry {
  id: string
  kind: 'system' | 'message'
  // System (activity_log)
  entity_type?: string
  action?: string
  metadata?: Record<string, unknown>
  // Message (project_thread)
  message?: string
  // Common
  user_name: string | null
  user_avatar_url: string | null
  created_at: string
}

function tsToWhen(s: string): string {
  const sec = Math.floor((Date.now() - new Date(s).getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`
  return new Date(s).toLocaleDateString()
}

function describeSystem(entry: ActivityEntry): string {
  const what = (entry.action ?? '').replace(/_/g, ' ')
  const meta = entry.metadata ?? {}
  const md = meta as { from?: unknown; to?: unknown; name?: unknown; field?: unknown }

  // Common patterns
  if (entry.action === 'stage_changed' && md.from && md.to) return `moved stage from ${md.from} → ${md.to}`
  if (entry.action === 'mentioned_in_slack')                return `mentioned this project in Slack`
  if (entry.action === 'created')                            return `created a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action === 'updated')                            return `updated a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action === 'deleted')                            return `deleted a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action?.endsWith('_changed') && md.field)        return `changed ${md.field}${md.from !== undefined && md.to !== undefined ? `: ${md.from} → ${md.to}` : ''}`
  return what
}

export function ProjectActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center gap-2">
        <Activity size={14} className="text-[#3E3E3C]" />
        <h3 className="text-[14px] font-bold text-[#181818]">Activity</h3>
        <span className="text-[11px] text-[#94a3b8]">({entries.length})</span>
      </div>
      {entries.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No activity yet.</div>
      ) : (
        <div className="px-6 py-5 space-y-3">
          {entries.map(e => (
            <div key={e.id} className="flex items-start gap-2.5">
              <Avatar name={e.user_name ?? 'System'} imageUrl={e.user_avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] text-[#181818] leading-snug">
                  <span className="font-semibold">{e.user_name ?? 'Someone'}</span>{' '}
                  {e.kind === 'message' ? (
                    <span className="text-[#3E3E3C]">posted in Slack: </span>
                  ) : (
                    <span className="text-[#3E3E3C]">{describeSystem(e)}</span>
                  )}
                </p>
                {e.kind === 'message' && e.message && (
                  <p className="text-[12.5px] text-[#3E3E3C] mt-0.5 line-clamp-2 italic">&ldquo;{e.message}&rdquo;</p>
                )}
                <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-[#94a3b8]">
                  {e.kind === 'message' ? <MessageSquare size={9} /> : <Tag size={9} />}
                  <span>{tsToWhen(e.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
