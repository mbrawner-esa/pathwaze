'use client'
import { Avatar } from '@/components/ui/Avatar'
import { Slack, Mail } from 'lucide-react'
import { MessageText, type MentionUser } from '@/components/ui/MessageText'

export interface ProjectThread {
  id: string
  slack_ts: string | null
  slack_thread_ts: string | null
  user_name: string | null
  user_avatar_url: string | null
  message: string
  created_at: string
  source?: string | null
  subject?: string | null
  from_addr?: string | null
}

function tsToDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function ThreadsTab({ threads, channelLinked, users = [] }: { threads: ProjectThread[]; channelLinked: boolean; users?: MentionUser[] }) {
  // Show the empty state only when there's genuinely nothing to show. A project
  // can accumulate email threads even without a linked Slack channel.
  if (threads.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9]">
          <h3 className="text-[14px] font-bold text-[#181818]">Threads</h3>
        </div>
        <div className="px-6 py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#F1F5F9] flex items-center justify-center">
            <Mail size={20} className="text-[#70A0D0]" />
          </div>
          <p className="text-[13.5px] text-[#181818] font-semibold">No messages yet</p>
          <p className="text-[12.5px] text-[#706E6B] mt-1 max-w-md mx-auto leading-relaxed">
            {channelLinked
              ? <>Channel messages and stakeholder emails will appear here. Start a conversation in the linked Slack channel, or connect Outlook in <strong>Settings</strong> to mirror stakeholder email.</>
              : <>Link a Slack channel via the <strong>⋯ menu → Sync Slack channel</strong>, or connect Outlook in <strong>Settings</strong> to mirror emails with this project&apos;s stakeholders here.</>}
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
        {channelLinked && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E8F5EA] text-[#1E7B3A] inline-flex items-center gap-1">
            <Slack size={10} /> Slack linked
          </span>
        )}
      </div>
      <div className="px-6 py-5 space-y-4">
        {threads.map(t => {
          const isEmail = t.source === 'email'
          const isReply = !isEmail && t.slack_thread_ts && t.slack_thread_ts !== t.slack_ts
          return (
            <div key={t.id} className={`flex gap-3 ${isReply ? 'pl-8 border-l-2 border-[#f1f5f9]' : ''}`}>
              <Avatar name={t.user_name ?? (isEmail ? 'Email' : 'Slack user')} imageUrl={t.user_avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#181818]">{t.user_name ?? (isEmail ? 'Email' : 'Slack user')}</span>
                  <span className="text-[10.5px] text-[#706E6B]">{tsToDate(t.created_at)}</span>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${isEmail ? 'bg-[#EFF6FF] text-[#1d4ed8]' : 'bg-[#F4ECE7] text-[#611f69]'}`}>
                    {isEmail ? <><Mail size={9} /> Email</> : <><Slack size={9} /> Slack</>}
                  </span>
                </div>
                {isEmail && t.subject && (
                  <p className="text-[12.5px] font-semibold text-[#181818] mt-0.5">{t.subject}</p>
                )}
                {isEmail && t.from_addr && (
                  <p className="text-[10.5px] text-[#94a3b8] mt-0.5">from {t.from_addr}</p>
                )}
                <p className="text-[13px] text-[#181818] mt-0.5 whitespace-pre-wrap">
                  <MessageText text={t.message} users={users} />
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
