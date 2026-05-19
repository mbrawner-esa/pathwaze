'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { PathwazeLogo } from '@/components/ui/PathwazeLogo'
import { Suspense } from 'react'

function LoginInner() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showEmail, setShowEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [slackLoading, setSlackLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const initialError = params.get('error')
  const supabase = createClient()

  async function handleSlackLogin() {
    setSlackLoading(true); setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'slack_oidc',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) { setError(error.message); setSlackLoading(false) }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center px-4 relative overflow-hidden"
      style={{ backgroundColor: '#0F1B26' }}>
      <LoginBackdrop />
      <div className="relative z-10 w-full max-w-[400px] rounded-xl shadow-2xl p-9" style={{ backgroundColor: '#F4F7FA' }}>
        <div className="flex flex-col items-center mb-7">
          <PathwazeLogo style={{ height: 44, width: 'auto' }} />
        </div>

        {(error || initialError) && (
          <div className="mb-4 px-3 py-2.5 bg-[#fef2f2] border border-[#fecaca] rounded text-[12.5px] text-[#991b1b]">
            {error || initialError}
          </div>
        )}

        {/* Primary: Slack SSO */}
        <button
          onClick={handleSlackLogin}
          disabled={slackLoading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-[#4A154B] hover:bg-[#3d1140] text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          <SlackIcon />
          {slackLoading ? 'Redirecting to Slack…' : 'Continue with Slack'}
        </button>

        <p className="text-[11.5px] text-[#94a3b8] text-center mt-3">
          New users land in a pending queue for admin approval.
        </p>

        {/* Collapsible email fallback */}
        <div className="mt-7 pt-5 border-t border-[#f1f5f9]">
          {!showEmail ? (
            <button
              onClick={() => setShowEmail(true)}
              className="w-full text-[12px] text-[#706E6B] hover:text-[#181818] transition-colors"
            >
              Admin? Sign in with email →
            </button>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div>
                <label className="label block mb-1">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C303C]"
                  required
                />
              </div>
              <div>
                <label className="label block mb-1">Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C303C]"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#0F1B26' }} />}>
      <LoginInner />
    </Suspense>
  )
}

// Inline brand backdrop — four concentric-arc systems bleeding off the corners,
// plus a faint dot grid. No external asset, no broken-image risk.
function LoginBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Faint dot grid */}
      <defs>
        <pattern id="dots" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1.2" fill="#2A4870" opacity="0.45" />
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#dots)" />

      {/* Arc system: top-left, bleeding off */}
      <g fill="none" stroke="#2A4870" strokeOpacity="0.55" strokeWidth="1.5">
        <circle cx="0" cy="0" r="240" />
        <circle cx="0" cy="0" r="380" />
        <circle cx="0" cy="0" r="520" />
        <circle cx="0" cy="0" r="660" />
      </g>
      <circle cx="0" cy="0" r="100" fill="none" stroke="#F8D068" strokeOpacity="0.5" strokeWidth="2" />

      {/* Arc system: top-right */}
      <g fill="none" stroke="#3A5F8C" strokeOpacity="0.45" strokeWidth="1.5">
        <circle cx="1920" cy="120" r="260" />
        <circle cx="1920" cy="120" r="400" />
        <circle cx="1920" cy="120" r="540" />
        <circle cx="1920" cy="120" r="680" />
      </g>
      <circle cx="1920" cy="120" r="110" fill="none" stroke="#F8D068" strokeOpacity="0.4" strokeWidth="2" />

      {/* Arc system: bottom-left */}
      <g fill="none" stroke="#2A4870" strokeOpacity="0.5" strokeWidth="1.5">
        <circle cx="160" cy="1080" r="220" />
        <circle cx="160" cy="1080" r="360" />
        <circle cx="160" cy="1080" r="500" />
        <circle cx="160" cy="1080" r="640" />
      </g>
      <circle cx="160" cy="1080" r="90" fill="none" stroke="#F8D068" strokeOpacity="0.45" strokeWidth="2" />

      {/* Arc system: bottom-right, bleeding off */}
      <g fill="none" stroke="#3A5F8C" strokeOpacity="0.5" strokeWidth="1.5">
        <circle cx="1920" cy="1080" r="280" />
        <circle cx="1920" cy="1080" r="430" />
        <circle cx="1920" cy="1080" r="580" />
        <circle cx="1920" cy="1080" r="730" />
      </g>
      <circle cx="1920" cy="1080" r="120" fill="none" stroke="#F8D068" strokeOpacity="0.5" strokeWidth="2" />

      {/* Soft radial glow to keep center calm where the form sits */}
      <defs>
        <radialGradient id="centerVignette" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0F1B26" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#0F1B26" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0F1B26" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#centerVignette)" />
    </svg>
  )
}

function SlackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E"/>
    </svg>
  )
}
