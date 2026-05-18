'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown } from 'lucide-react'
import {
  Squares2X2Icon,
  BriefcaseIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  FolderIcon,
} from '@heroicons/react/24/solid'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { PathwazeLogo } from '@/components/ui/PathwazeLogo'
import { Avatar } from '@/components/ui/Avatar'

interface Notification {
  id: string
  entity_type: string
  entity_id: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
  user_id: string
  users?: { full_name: string; avatar_url?: string | null } | null
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60)    return `${sec}s ago`
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function formatAction(n: Notification): { who: string; action: string; entity: string } {
  return {
    who: n.users?.full_name || 'Someone',
    action: n.action.replace(/_/g, ' '),
    entity: n.entity_type,
  }
}

// Map an activity_log row → URL the user should land on when clicking it.
// Returns null when we can't deep-link (e.g. permit/meter without project_id).
function notifHref(n: Notification): string | null {
  switch (n.entity_type) {
    case 'project':     return `/projects/${n.entity_id}`
    case 'task':        return `/tasks?id=${n.entity_id}`
    case 'stakeholder': return `/stakeholders?id=${n.entity_id}`
    // permits/meters/buildings/systems live inside a project; metadata may carry project_id
    case 'permit':
    case 'meter':
    case 'building':
    case 'system': {
      const pid = (n.metadata as { project_id?: string })?.project_id
      return pid ? `/projects/${pid}` : null
    }
    default: return null
  }
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', Icon: Squares2X2Icon },
  { label: 'Projects', href: '/projects', Icon: BriefcaseIcon },
  { label: 'Tasks', href: '/tasks', Icon: ClipboardDocumentCheckIcon },
  { label: 'Stakeholders', href: '/stakeholders', Icon: UserGroupIcon },
  { label: 'Dataroom', href: '/dataroom', Icon: FolderIcon },
]

interface NavBarProps {
  user: { full_name: string; role: string; email: string; avatar_url?: string | null }
}

export function NavBar({ user }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  // Load notifications on mount; compute unread vs. last_seen timestamp in localStorage
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(data => {
        const list: Notification[] = data.notifications ?? []
        setNotifs(list)
        const lastSeen = typeof window !== 'undefined' ? (localStorage.getItem('notif_last_seen') || '') : ''
        setUnread(list.filter(n => n.created_at > lastSeen).length)
      })
      .catch(() => {})
  }, [])

  function openNotif() {
    setShowNotif(s => !s)
    if (!showNotif && notifs.length) {
      const latest = notifs[0].created_at
      localStorage.setItem('notif_last_seen', latest)
      setUnread(0)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav
      style={{ height: 52 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[#0F1B26] border-b border-white/[0.06] flex items-center px-6"
    >
      <Link href="/dashboard" className="flex items-center w-48 hover:opacity-90 transition-opacity">
        <PathwazeLogo variant="dark" style={{ height: 32, width: 'auto' }} />
      </Link>
      <div className="flex-1 flex items-center gap-0.5">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.Icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                'flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all mx-0.5 ' +
                (active
                  ? 'bg-white/[0.10] text-white'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white')
              }
            >
              <Icon className="w-[15px] h-[15px]" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
      <div className="flex items-center gap-2 w-48 justify-end">
        <div className="relative">
          <button onClick={openNotif} className="relative p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all">
            <Bell size={17} strokeWidth={2} />
            {unread > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotif && (
            <>
              <div onClick={() => setShowNotif(false)} className="fixed inset-0 z-40" />
              <div className="absolute right-0 top-11 bg-white rounded-lg shadow-xl border border-[#e2e8f0] w-[340px] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
                  <h3 className="text-[13px] font-bold text-[#181818]">Recent activity</h3>
                  <span className="text-[11px] text-[#94a3b8]">{notifs.length}</span>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[12.5px] text-[#706E6B]">No activity yet.</div>
                  ) : notifs.map(n => {
                    const { who, action, entity } = formatAction(n)
                    const href = notifHref(n)
                    const body = (
                      <div className="flex items-start gap-2.5">
                        <Avatar name={who} imageUrl={n.users?.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] text-[#181818] leading-snug">
                            <span className="font-semibold">{who}</span>{' '}
                            <span className="text-[#3E3E3C]">{action}</span>{' '}
                            <span className="text-[#706E6B]">on {entity}</span>
                          </p>
                          <p className="text-[10.5px] text-[#94a3b8] mt-0.5">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    )
                    return href ? (
                      <Link key={n.id} href={href} onClick={() => setShowNotif(false)}
                        className="block px-4 py-2.5 border-b border-[#f1f5f9] last:border-b-0 hover:bg-[#fafbfc] cursor-pointer">
                        {body}
                      </Link>
                    ) : (
                      <div key={n.id} className="px-4 py-2.5 border-b border-[#f1f5f9] last:border-b-0">
                        {body}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-1.5 p-1 pr-2 rounded-md text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
          >
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.full_name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#70A0D0] flex items-center justify-center text-white text-[11px] font-semibold tracking-wide">
                {initials}
              </div>
            )}
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-11 bg-white rounded-lg shadow-xl border border-[#e2e8f0] py-1 w-44 z-50">
              <div className="px-4 py-2.5 border-b border-[#f1f5f9]">
                <p className="text-[13px] font-semibold text-[#181818]">{user.full_name}</p>
                <p className="text-[11.5px] text-[#706E6B] capitalize mt-0.5">{user.role}</p>
              </div>
              {user.role === 'admin' && (
                <Link href="/admin/users" onClick={() => setShowUserMenu(false)}
                  className="block w-full text-left px-4 py-2 text-[13px] text-[#181818] hover:bg-[#f8fafc]">User Management</Link>
              )}
              <button className="w-full text-left px-4 py-2 text-[13px] text-[#181818] hover:bg-[#f8fafc]">Settings</button>
              <button onClick={logout} className="w-full text-left px-4 py-2 text-[13px] text-[#dc2626] hover:bg-[#fef2f2]">Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
