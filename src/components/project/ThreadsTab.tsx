'use client'
import { Avatar } from '@/components/ui/Avatar'
import { Slack } from 'lucide-react'

export interface ProjectThread {
  id: string
  slack_ts: string
  slack_thread_ts: string | null
  user_name: string | null
  user_avatar_url: string | null
  message: string
  created_at: string
}

function tsToDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function ThreadsTab({ threads, channelLinked }: { threads: ProjectThread[]; channelLinked: boolean }) {
  if (!channelLinked) {
    return (
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[14px] font-bold text-[#181818]">Threads</h3>
        </div>
        <div className="px-6 py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F4ECE7] flex items-center justify-center">
            <Slack size={20} className="text-[#611f69]" />
          </div>
          <p className="text-[13.5px] text-[#181818] font-semibold">No Slack channel linked yet</p>
          <p className="text-[12.5px] text-[#706E6B] mt-1 max-w-md mx-auto leading-relaxed">
            Use the <strong>⋯ menu → Sync Slack channel</strong> at the top of this project to link a channel. Channel messages will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-bold text-[#181818]">Threads</h3>
          <span className="text-[11px] text-[#94a3b8]">({threads.length})</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E8F5EA] text-[#1E7B3A] inline-flex items-center gap-1">
          <Slack size={10} /> Slack linked
        </span>
      </div>
      {threads.length === 0 ? (
        <div className="px-6 py-12 text-center text-[13px] text-[#706E6B]">No messages yet — start a conversation in the linked Slack channel.</div>
      ) : (
        <div className="px-6 py-5 space-y-4">
          {threads.map(t => (
            <div key={t.id} className={`flex gap-3 ${t.slack_thread_ts && t.slack_thread_ts !== t.slack_ts ? 'pl-8 border-l-2 border-[#f1f5f9]' : ''}`}>
              <Avatar name={t.user_name ?? 'Slack user'} imageUrl={t.user_avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-[#181818]">{t.user_name ?? 'Slack user'}</span>
                  <span className="text-[10.5px] text-[#706E6B]">{tsToDate(t.created_at)}</span>
                </div>
                <p className="text-[13px] text-[#181818] mt-0.5 whitespace-pre-wrap">{t.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
