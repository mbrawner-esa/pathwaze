'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }
  return (
    <button onClick={signOut} className="text-[12px] text-[#706E6B] hover:text-[#181818] underline">
      Sign out
    </button>
  )
}
