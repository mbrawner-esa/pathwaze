'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'

export interface SettingsUser {
  id: string
  email: string
  full_name: string
  role: string
  status: string
  avatar_url: string | null
  timezone: string | null
  timezone_label: string | null
  title: string | null
  slack_display_name: string | null
  profile_synced_at: string | null
  notify_slack_task_assigned: boolean
  notify_slack_task_status: boolean
  notify_slack_task_threads: boolean
  notify_email_task_assigned: boolean
  notify_email_task_complete: boolean
  subscribed_task_types: string[] | null
}

const ALL_TASK_TYPES = [
  'Design', 'Engineering', 'Permitting', 'Interconnection',
  'Financial', 'Legal', 'Construction', 'Operations', 'Administrative',
] as const

export function SettingsClient({ user }: { user: SettingsUser }) {
  const router = useRouter()
  const supabase = createClient()

  const [prefs, setPrefs] = useState({
    notify_slack_task_assigned: user.notify_slack_task_assigned ?? true,
    notify_slack_task_status:   user.notify_slack_task_status   ?? true,
    notify_slack_task_threads:  user.notify_slack_task_threads  ?? true,
    notify_email_task_assigned: user.notify_email_task_assigned ?? true,
    notify_email_task_complete: user.notify_email_task_complete ?? true,
  })
  const [subs, setSubs] = useState<string[]>(user.subscribed_task_types ?? [...ALL_TASK_TYPES])
  const [saving, setSaving] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function patch(field: keyof typeof prefs, value: boolean) {
    setPrefs(p => ({ ...p, [field]: value }))
    setSaving(field); setErr(null)
    const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setErr(b?.error || 'Save failed')
      setPrefs(p => ({ ...p, [field]: !value }))
    }
    setSaving(null)
  }

  async function toggleSubscription(type: string) {
    const next = subs.includes(type) ? subs.filter(t => t !== type) : [...subs, type]
    const prev = subs
    setSubs(next)
    setSaving('subscribed_task_types'); setErr(null)
    const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscribed_task_types: next }) })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      setErr(b?.error || 'Save failed')
      setSubs(prev)
    }
    setSaving(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const lastSync = user.profile_synced_at
    ? new Date(user.profile_synced_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Not yet synced'

  return (
    <div className="px-8 py-7 max-w-3xl">
      <div className="mb-7">
        <h1 className="text-[22px] font-bold text-[#181818] tracking-tight">Settings</h1>
        <p className="text-[13px] text-[#706E6B] mt-1">Your profile, notification preferences, and account.</p>
      </div>

      {err && (
        <div className="mb-4 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12.5px] text-[#991b1b]">
          {err}
        </div>
      )}

      {/* Profile */}
      <Section title="Profile" subtitle="Synced from Slack — update there to change.">
        <div className="flex items-start gap-5">
          <Avatar name={user.full_name || user.email} imageUrl={user.avatar_url} size="lg" />
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
            <Field label="Name" value={user.full_name} />
            <Field label="Email" value={user.email} />
            <Field label="Title" value={user.title || '—'} />
            <Field label="Role" value={<span className="capitalize">{user.role}</span>} />
            <Field label="Timezone" value={user.timezone_label || user.timezone || '—'} />
            <Field label="Status" value={<span className="capitalize">{user.status}</span>} />
          </div>
        </div>
        <p className="text-[11px] text-[#94a3b8] mt-4">Last synced from Slack: {lastSync}</p>
      </Section>

      {/* Slack DMs */}
      <Section title="Slack notifications" subtitle="Control which Slack DMs Pathwaze sends you.">
        <Toggle
          label="Task assigned to me"
          description="DM when a teammate assigns you a task."
          checked={prefs.notify_slack_task_assigned}
          saving={saving === 'notify_slack_task_assigned'}
          onChange={v => patch('notify_slack_task_assigned', v)}
        />
        <Toggle
          label="Task status changes"
          description="DM when the status of a task assigned to you changes."
          checked={prefs.notify_slack_task_status}
          saving={saving === 'notify_slack_task_status'}
          onChange={v => patch('notify_slack_task_status', v)}
        />
        <Toggle
          label="Thread replies"
          description="DM thread updates when teammates comment on a task assigned to you."
          checked={prefs.notify_slack_task_threads}
          saving={saving === 'notify_slack_task_threads'}
          onChange={v => patch('notify_slack_task_threads', v)}
        />
      </Section>

      {/* Email */}
      <Section title="Email notifications" subtitle="Control which Pathwaze emails you receive.">
        <Toggle
          label="Task assigned to me"
          description="Email when a teammate assigns you a task."
          checked={prefs.notify_email_task_assigned}
          saving={saving === 'notify_email_task_assigned'}
          onChange={v => patch('notify_email_task_assigned', v)}
        />
        <Toggle
          label="My tasks completed"
          description="Email when a task you created is marked complete."
          checked={prefs.notify_email_task_complete}
          saving={saving === 'notify_email_task_complete'}
          onChange={v => patch('notify_email_task_complete', v)}
        />
        <p className="text-[11px] text-[#94a3b8] mt-3">
          In-app notifications (the bell icon) are always on.
          Channel posts for project events depend on each project&apos;s linked Slack channel.
        </p>
      </Section>

      {/* Task subscriptions */}
      {user.role !== 'investor' && (
        <Section title="Task subscriptions" subtitle="Which task types you want to see in the Task Tracker. Tasks you create, are assigned to, or approve are always visible regardless of subscriptions.">
          <div className="flex flex-wrap gap-2">
            {ALL_TASK_TYPES.map(t => {
              const on = subs.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleSubscription(t)}
                  disabled={saving === 'subscribed_task_types'}
                  className={`px-3 py-1.5 text-[12.5px] font-semibold rounded-full border transition-all ${on ? 'bg-[#EFF6FF] border-[#bfdbfe] text-[#1d4ed8]' : 'bg-white border-[#e2e8f0] text-[#706E6B] hover:bg-[#fafbfc]'}`}
                >
                  {on && <span className="mr-1">✓</span>}{t}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-[#94a3b8] mt-3">
            {user.role === 'admin' || user.role === 'manager'
              ? 'As an admin/manager you see all tasks regardless of subscriptions — these settings are kept for when your role changes.'
              : 'Public tasks of unsubscribed types are hidden from your Task Tracker.'}
          </p>
        </Section>
      )}

      {/* Account */}
      <Section title="Account" subtitle="">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-[#181818]">Signed in as <strong>{user.email}</strong></p>
            <p className="text-[12px] text-[#706E6B] mt-0.5">Sign out of Pathwaze on this device.</p>
          </div>
          <button onClick={signOut} className="px-3 py-1.5 text-[12.5px] font-semibold border border-[#e2e8f0] rounded hover:bg-[#fafbfc] text-[#3E3E3C]">
            Sign out
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden mb-5">
      <div className="px-6 py-4 border-b border-[#f1f5f9]">
        <h2 className="text-[14px] font-bold text-[#181818]">{title}</h2>
        {subtitle && <p className="text-[12px] text-[#706E6B] mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8] mb-0.5">{label}</p>
      <p className="text-[13px] text-[#181818]">{value || '—'}</p>
    </div>
  )
}

function Toggle({ label, description, checked, saving, onChange }: { label: string; description: string; checked: boolean; saving: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#f1f5f9] last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#181818]">{label}</p>
        <p className="text-[12px] text-[#706E6B] mt-0.5 leading-snug">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        disabled={saving}
        role="switch"
        aria-checked={checked}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${checked ? 'bg-[#70A0D0]' : 'bg-[#cbd5e1]'} ${saving ? 'opacity-60' : ''}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
