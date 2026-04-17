'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Projects', href: '/projects' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Stakeholders', href: '/stakeholders' },
  { label: 'Dataroom', href: '/dataroom' },
]

interface NavBarProps {
  user: { full_name: string; role: string; email: string }
}

export function NavBar({ user }: NavBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const initials = user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav style={{ height: 52 }} className="fixed top-0 left-0 right-0 z-50 bg-[#2F3E50] flex items-center px-6 shadow-md">
      <div className="flex items-center gap-2 w-48">
        <span className="text-white font-bold text-lg tracking-tight">Pathwaze</span>
      </div>
      <div className="flex-1 flex items-center justify-center gap-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 h-[52px] flex items-center text-sm font-medium transition-colors relative"
              style={{
                color: active ? '#fff' : '#94a3b8',
                borderBottom: active ? '2px solid #E6C87A' : '2px solid transparent',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
      <div className="flex items-center gap-3 w-48 justify-end">
        <button className="text-[#94a3b8] hover:text-white transition-colors">
          <Bell size={18} />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 text-[#94a3b8] hover:text-white transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#E6C87A] flex items-center justify-center text-[#2F3E50] text-xs font-bold">
              {initials}
            </div>
            <ChevronDown size={14} />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-[#f1f5f9] py-1 w-40 z-50">
              <div className="px-4 py-2 border-b border-[#f1f5f9]">
                <p className="text-xs font-semibold text-[#2F3E50]">{user.full_name}</p>
                <p className="text-xs text-[#6E879E] capitalize">{user.role}</p>
              </div>
              <button className="w-full text-left px-4 py-2 text-sm text-[#334155] hover:bg-[#f8fafc]">Settings</button>
              <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-[#f8fafc]">Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
