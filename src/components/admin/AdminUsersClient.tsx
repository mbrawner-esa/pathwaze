'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Plus, Trash2, X } from 'lucide-react'

export interface AdminUserRow {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'team' | 'investor' | string
  status: 'pending' | 'active' | 'disabled' | string
  created_at: string
}

interface PendingInvite {
  email: string
  role: string
  invited_at: string
  accepted_at: string | null
}

const ROLES: AdminUserRow['role'][] = ['admin', 'team', 'investor']

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  pending:  { bg: '#fef3c7', text: '#92400e' },
  active:   { bg: '#dcfce7', text: '#166534' },
  disabled: { bg: '#fef2f2', text: '#991b1b' },
}

const ROLE_PILL: Record<string, { bg: string; text: string }> = {
  admin:    { bg: '#eef2ff', text: '#3730A3' },
  team:     { bg: '#f1f5f9', text: '#475569' },
  investor: { bg: '#f5f3ff', text: '#6d28d9' },
}

export function AdminUsersClient({ users, pendingInvites }: { users: AdminUserRow[]; pendingInvites: PendingInvite[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id); setErr(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        setErr(b?.error || `Update failed (${res.status})`)
      } else { router.refresh() }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(null)
  }

  async function deleteInvite(email: string) {
    if (!confirm(`Cancel invite for ${email}?`)) return
    setBusy(email); setErr(null)
    try {
      const res = await fetch(`/api/admin/invites?email=${encodeURIComponent(email)}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(b?.error || 'Delete failed') }
      else router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(null)
  }

  const pending = users.filter(u => u.status === 'pending')
  const active  = users.filter(u => u.status === 'active')
  const disabled = users.filter(u => u.status === 'disabled')

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-[#181818] tracking-tight">User Management</h1>
          <p className="text-[13px] text-[#706E6B] mt-1">Invite teammates, approve Slack sign-ins, manage roles.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary inline-flex items-center gap-1.5">
          <Plus size={14} /> Invite Users
        </button>
      </div>

      {err && (
        <div className="mb-4 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12.5px] text-[#991b1b]">
          {err}
        </div>
      )}

      <SectionCard title="Pending approval" count={pending.length}
        empty="No new sign-ins waiting for approval.">
        <Table users={pending} busy={busy} onPatch={patch} actions="pending" />
      </SectionCard>

      <SectionCard title="Outstanding invites" count={pendingInvites.length}
        empty="No outstanding invites — invite teammates to bring them on.">
        {pendingInvites.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
                <th className="text-left px-4 py-3 label">Email</th>
                <th className="text-left px-4 py-3 label">Role</th>
                <th className="text-left px-4 py-3 label">Sent</th>
                <th className="text-right px-4 py-3 label">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map(i => {
                const rp = ROLE_PILL[i.role] ?? { bg: '#f1f5f9', text: '#475569' }
                return (
                  <tr key={i.email} className="border-b border-[#f1f5f9]">
                    <td className="px-4 py-3 text-[#181818]">{i.email}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: rp.bg, color: rp.text }}>{i.role}</span></td>
                    <td className="px-4 py-3 text-[#706E6B]">{new Date(i.invited_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button disabled={busy === i.email} onClick={() => deleteInvite(i.email)}
                        className="text-[12px] text-[#dc2626] hover:underline inline-flex items-center gap-1">
                        <Trash2 size={11} /> Cancel
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      <SectionCard title="Active users" count={active.length} empty="No active users.">
        <Table users={active} busy={busy} onPatch={patch} actions="active" />
      </SectionCard>

      {disabled.length > 0 && (
        <SectionCard title="Disabled" count={disabled.length} empty="">
          <Table users={disabled} busy={busy} onPatch={patch} actions="disabled" />
        </SectionCard>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={() => { setShowInvite(false); router.refresh() }} />}
    </div>
  )
}

// ── Invite modal ──────────────────────────────────────────────────
function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState('team')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<{ invited: string[]; sent: number; sendingConfigured: boolean } | null>(null)

  async function submit() {
    setBusy(true); setErr(null); setResult(null)
    const list = emails.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean)
    if (list.length === 0) { setErr('Add at least one email.'); setBusy(false); return }
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: list, role }),
      })
      const body = await res.json()
      if (!res.ok) { setErr(body?.error || 'Failed'); setBusy(false); return }
      setResult(body)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error')
    }
    setBusy(false)
  }

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/30 z-40" />
      <div className="fixed left-1/2 top-[15vh] -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl w-full max-w-[480px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-bold text-[#181818]">Invite Users</h3>
            <p className="text-[11.5px] text-[#706E6B] mt-0.5">They&apos;ll receive an email and skip the approval queue.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#f1f5f9] text-[#706E6B]"><X size={15} /></button>
        </div>

        {result ? (
          <div className="px-6 py-5">
            <div className="mb-3 px-3 py-2 bg-[#dcfce7] border border-[#bbf7d0] rounded text-[12.5px] text-[#166534]">
              Pre-approved {result.invited.length} {result.invited.length === 1 ? 'email' : 'emails'}.
              {result.sendingConfigured
                ? ` Sent ${result.sent} email${result.sent !== 1 ? 's' : ''}.`
                : ' Resend isn’t configured yet — share the login link manually for now.'}
            </div>
            <ul className="mb-4 max-h-[180px] overflow-y-auto text-[12.5px] text-[#3E3E3C] space-y-1">
              {result.invited.map(e => <li key={e}>• {e}</li>)}
            </ul>
            <div className="flex justify-end">
              <button onClick={onDone} className="btn-primary">Done</button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-5">
            <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">Emails</label>
            <textarea
              value={emails}
              onChange={e => setEmails(e.target.value)}
              placeholder="name@esa-solar.com, another@esa-solar.com&#10;or one per line"
              rows={5}
              className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md focus:outline-none focus:border-[#70A0D0] focus:ring-2 focus:ring-[#70A0D0]/20 resize-y"
            />
            <p className="text-[11px] text-[#94a3b8] mt-1">Comma, semicolon, or newline-separated.</p>

            <div className="mt-4">
              <label className="block text-[11px] font-semibold text-[#3E3E3C] mb-1.5">Default role</label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-[#e2e8f0] rounded-md bg-white">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {err && <div className="mt-3 px-3 py-2 bg-[#fef2f2] border border-[#fecaca] rounded text-[12px] text-[#991b1b]">{err}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} disabled={busy} className="btn-secondary">Cancel</button>
              <button onClick={submit} disabled={busy} className="btn-primary">{busy ? 'Sending…' : 'Send Invites'}</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function SectionCard({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden mb-5">
      <div className="px-6 py-3.5 border-b border-[#f1f5f9] flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-[#181818]">{title}</h2>
        <span className="text-[11px] text-[#94a3b8]">({count})</span>
      </div>
      {count === 0 ? (
        <div className="px-6 py-10 text-center text-[12.5px] text-[#706E6B]">{empty}</div>
      ) : children}
    </section>
  )
}

function Table({ users, busy, onPatch, actions }: {
  users: AdminUserRow[]
  busy: string | null
  onPatch: (id: string, body: Record<string, unknown>) => void
  actions: 'pending' | 'active' | 'disabled'
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[#f1f5f9] bg-[#fafafa]">
          <th className="text-left px-4 py-3 label">Name</th>
          <th className="text-left px-4 py-3 label">Email</th>
          <th className="text-left px-4 py-3 label">Role</th>
          <th className="text-left px-4 py-3 label">Status</th>
          <th className="text-right px-4 py-3 label">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => {
          const sp = STATUS_PILL[u.status] ?? { bg: '#f1f5f9', text: '#475569' }
          const rp = ROLE_PILL[u.role]     ?? { bg: '#f1f5f9', text: '#475569' }
          const disabled = busy === u.id
          return (
            <tr key={u.id} className="border-b border-[#f1f5f9]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={u.full_name || u.email} size="sm" />
                  <span className="font-medium text-[#181818]">{u.full_name || '—'}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-[#3E3E3C]">{u.email}</td>
              <td className="px-4 py-3">
                <select
                  value={u.role}
                  disabled={disabled}
                  onChange={e => onPatch(u.id, { role: e.target.value })}
                  className="px-2 py-0.5 text-xs font-medium border border-[#e2e8f0] rounded bg-white"
                  style={{ background: rp.bg, color: rp.text }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sp.bg, color: sp.text }}>{u.status}</span>
              </td>
              <td className="px-4 py-3 text-right">
                {actions === 'pending' && (
                  <div className="flex gap-2 justify-end">
                    <button disabled={disabled} onClick={() => onPatch(u.id, { status: 'active' })}
                      className="px-2.5 py-1 text-[11.5px] font-semibold bg-[#dcfce7] text-[#166534] rounded hover:bg-[#bbf7d0]">
                      Approve
                    </button>
                    <button disabled={disabled} onClick={() => onPatch(u.id, { status: 'disabled' })}
                      className="px-2.5 py-1 text-[11.5px] font-semibold bg-[#fef2f2] text-[#991b1b] rounded hover:bg-[#fecaca]">
                      Decline
                    </button>
                  </div>
                )}
                {actions === 'active' && (
                  <button disabled={disabled} onClick={() => onPatch(u.id, { status: 'disabled' })}
                    className="px-2.5 py-1 text-[11.5px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] rounded">
                    Disable
                  </button>
                )}
                {actions === 'disabled' && (
                  <button disabled={disabled} onClick={() => onPatch(u.id, { status: 'active' })}
                    className="px-2.5 py-1 text-[11.5px] font-semibold bg-[#dcfce7] text-[#166534] rounded hover:bg-[#bbf7d0]">
                    Reactivate
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
