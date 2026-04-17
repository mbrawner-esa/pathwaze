import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavBar } from './NavBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('full_name, role, email').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <NavBar user={profile ?? { full_name: user.email ?? '', role: 'team', email: user.email ?? '' }} />
      <main style={{ paddingTop: 52 }}>
        {children}
      </main>
    </div>
  )
}
