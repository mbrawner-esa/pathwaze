import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PathwazeLogo } from '@/components/ui/PathwazeLogo'
import { SignOutButton } from '@/components/auth/SignOutButton'

export default async function PendingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('users').select('status, full_name, email').eq('id', user.id).single()
  const status = (profile as { status?: string } | null)?.status

  // If they've already been approved, push them through
  if (status === 'active') redirect('/dashboard')
  if (status === 'disabled') redirect('/auth/login?error=Account+disabled')

  const p = profile as { status?: string; full_name?: string; email?: string } | null

  return (
    <div className="min-h-screen bg-[#1C303C] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center">
        <div className="flex flex-col items-center mb-6">
          <PathwazeLogo style={{ height: 44, width: 'auto' }} />
        </div>

        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#fef3c7] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>

        <h1 className="text-[18px] font-bold text-[#181818] mb-2">Awaiting approval</h1>
        <p className="text-[13px] text-[#3E3E3C] leading-relaxed mb-1">
          Hi {p?.full_name || 'there'} — your account is awaiting admin approval.
        </p>
        <p className="text-[12.5px] text-[#706E6B] leading-relaxed">
          You&apos;ll get access as soon as a Pathwaze admin approves your sign-in. This usually takes less than a day.
        </p>

        <div className="mt-6 px-4 py-3 bg-[#fafbfc] border border-[#e2e8f0] rounded-lg text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">Signed in as</div>
          <div className="text-[12.5px] text-[#181818]">{p?.email || user.email}</div>
        </div>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
