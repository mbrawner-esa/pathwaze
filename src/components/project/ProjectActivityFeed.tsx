'use client'
import { Avatar } from '@/components/ui/Avatar'
import { Activity, MessageSquare, Tag, StickyNote, Calendar, Paperclip } from 'lucide-react'
import { MessageText, type MentionUser } from '@/components/ui/MessageText'

export interface ActivityEntry {
  id: string
  kind: 'system' | 'message' | 'note'
  // System (activity_log)
  entity_type?: string
  action?: string
  metadata?: Record<string, unknown>
  // Message (project_thread)
  message?: string
  // Note (project_notes)
  note_type?: 'note' | 'event' | 'file'
  title?: string | null
  body?: string | null
  event_date?: string | null
  file_name?: string | null
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

// Pretty labels for the offtaker_pricing field names.
const PRICING_FIELD_LABELS: Record<string, string> = {
  version_label: 'name',
  revenue_type: 'revenue type',
  term_months: 'contract term',
  year1_contract_price: 'Year 1 price',
  escalation_rate: 'escalation rate',
  srec_treatment: 'SREC treatment',
  estimated_ntp: 'estimated NTP',
  estimated_cod: 'estimated COD',
  utility_escalation_rate: 'utility escalation',
  customer_term_savings: 'customer term savings',
  customer_term_npv: 'customer term NPV',
  quote_created_at: 'quote date',
  linked_system_ids: 'linked systems',
  meter_savings: 'meter savings',
}

function fmtPricingValue(field: string, v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  if (typeof v === 'object') return '—'
  if (field === 'year1_contract_price') return `$${Number(v).toFixed(4)}/kWh`
  if (field === 'term_months') return `${v} mo`
  if (field === 'escalation_rate' || field === 'utility_escalation_rate') return `${v}%`
  if (field === 'customer_term_savings' || field === 'customer_term_npv') return `$${Number(v).toLocaleString()}K`
  return String(v)
}

function describeSystem(entry: ActivityEntry): string {
  const what = (entry.action ?? '').replace(/_/g, ' ')
  const meta = entry.metadata ?? {}
  const md = meta as { from?: unknown; to?: unknown; name?: unknown; field?: unknown; option_label?: unknown; new_version?: unknown }

  // Pricing-option field change → friendly description with option + version.
  if (entry.entity_type === 'offtaker_pricing' && entry.action === 'field_changed' && md.field) {
    const f = String(md.field)
    const label = PRICING_FIELD_LABELS[f] ?? f.replace(/_/g, ' ')
    const opt = md.option_label ? String(md.option_label) : 'a pricing option'
    const ver = md.new_version ? ` (v${md.new_version})` : ''
    return `changed ${label} on ${opt}${ver}: ${fmtPricingValue(f, md.from)} → ${fmtPricingValue(f, md.to)}`
  }

  // Common patterns
  if (entry.action === 'stage_changed' && md.from && md.to) return `moved stage from ${md.from} → ${md.to}`
  if (entry.action === 'mentioned_in_slack')                return `mentioned this project in Slack`
  if (entry.action === 'created')                            return `created a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action === 'updated')                            return `updated a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action === 'deleted')                            return `deleted a ${entry.entity_type}${md.name ? ` "${md.name}"` : ''}`
  if (entry.action?.endsWith('_changed') && md.field)        return `changed ${md.field}${md.from !== undefined && md.to !== undefined ? `: ${md.from} → ${md.to}` : ''}`
  return what
}

export function ProjectActivityFeed({ entries, users = [] }: { entries: ActivityEntry[]; users?: MentionUser[] }) {
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
          {entries.map(e => {
            const noteIcon = e.note_type === 'event' ? <Calendar size={9} /> : e.note_type === 'file' ? <Paperclip size={9} /> : <StickyNote size={9} />
            return (
              <div key={e.id} className="flex items-start gap-2.5">
                <Avatar name={e.user_name ?? 'System'} imageUrl={e.user_avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-[#181818] leading-snug">
                    <span className="font-semibold">{e.user_name ?? 'Someone'}</span>{' '}
                    {e.kind === 'message' ? <span className="text-[#3E3E3C]">posted in Slack:</span>
                      : e.kind === 'note' ? <span className="text-[#3E3E3C]">{e.note_type === 'event' ? 'added an event' : e.note_type === 'file' ? 'attached a file' : 'added a note'}{e.title ? `: "${e.title}"` : ''}</span>
                      : <span className="text-[#3E3E3C]">{describeSystem(e)}</span>}
                  </p>
                  {e.kind === 'message' && e.message && (
                    <p className="text-[12.5px] text-[#3E3E3C] mt-0.5 line-clamp-2 italic">
                      &ldquo;<MessageText text={e.message} users={users} />&rdquo;
                    </p>
                  )}
                  {e.kind === 'note' && e.body && (
                    <p className="text-[12.5px] text-[#3E3E3C] mt-0.5 whitespace-pre-wrap line-clamp-3">{e.body}</p>
                  )}
                  {e.kind === 'note' && e.note_type === 'event' && e.event_date && (
                    <p className="text-[11.5px] text-[#706E6B] mt-0.5">📅 {new Date(e.event_date).toLocaleDateString()}</p>
                  )}
                  {e.kind === 'note' && e.note_type === 'file' && e.file_name && (
                    <p className="text-[11.5px] text-[#706E6B] mt-0.5">📎 {e.file_name}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-[#94a3b8]">
                    {e.kind === 'message' ? <MessageSquare size={9} /> : e.kind === 'note' ? noteIcon : <Tag size={9} />}
                    <span>{tsToWhen(e.created_at)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
