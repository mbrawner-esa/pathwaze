import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl
  const isAuth = pathname.startsWith('/auth')
  const isPending = pathname === '/auth/pending'
  // Routes that must run even while signed in (they clear/complete the session).
  const isSessionRoute = pathname.startsWith('/auth/callback') || pathname.startsWith('/auth/logout')
  const isPublic = pathname.startsWith('/investor') || pathname.startsWith('/email-logo')

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // getSession() refreshes an expired access token and writes the rotated
    // cookies back via setAll above. Middleware is the ONLY place that can
    // persist those cookies, so this call must stay here.
    //
    // The per-request `users` status/role query that used to run here was moved
    // into AppLayout (which already loads the profile) + the admin page guards.
    // It was a second blocking Supabase round-trip on every navigation and the
    // primary cause of MIDDLEWARE_INVOCATION_TIMEOUT (504). Middleware now makes
    // at most one auth call.
    const { data: { session } } = await supabase.auth.getSession()

    // Not signed in → bounce to login (except auth pages, the public investor
    // portal, and the email-logo asset referenced by invite emails).
    if (!session) {
      if (!isAuth && !isPublic) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }
      return supabaseResponse
    }

    // Signed in on an auth page → forward into the app. The pending / disabled
    // status gate now lives in AppLayout, so a pending user sent to /dashboard
    // here is immediately redirected on to /auth/pending (no loop: /auth/pending
    // and /auth/logout are excluded below).
    if (isAuth && !isSessionRoute && !isPending) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch (e) {
    // A transient Supabase/Auth failure must NOT log everyone out. Fail open and
    // let the request through — data stays protected by RLS + server-side checks,
    // and AppLayout's getUser() will re-validate on the page itself.
    console.error('[middleware] auth check failed; allowing request through:', e)
    return supabaseResponse
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
