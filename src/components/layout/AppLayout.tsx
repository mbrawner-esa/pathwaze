import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NavBar } from './NavBar'
import { WhatsNewGate } from '@/components/whats-new/WhatsNewGate'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('full_name, role, email, avatar_url, status').eq('id', user.id).single()

  // Status gate — moved here from the Edge middleware, which used to run this
  // same query on every request and was timing out (504). A server component
  // can't reliably clear cookies, so a disabled user is sent to the /auth/logout
  // route handler (which can) rather than being signed out inline.
  const status = (profile as { status?: string } | null)?.status
  if (status === 'disabled') redirect('/auth/logout?error=Account+disabled')
  if (status === 'pending') redirect('/auth/pending')

  // Read separately from the profile above: migration 053 is applied by hand on
  // Supabase, so until it runs this column doesn't exist. Keeping it out of the
  // profile select means a missing column can't take the whole nav down with it.
  const { data: seenRow } = await supabase
    .from('users')
    .select('whats_new_seen')
    .eq('id', user.id)
    .single() as unknown as { data: { whats_new_seen: string | null } | null }

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <NavBar user={profile ?? { full_name: user.email ?? '', role: 'team', email: user.email ?? '', avatar_url: null }} />
      <main style={{ paddingTop: 52 }}>
        {children}
      </main>
      {seenRow && <WhatsNewGate seen={seenRow.whats_new_seen} />}
    </div>
  )
}
