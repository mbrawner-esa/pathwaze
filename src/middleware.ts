import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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

  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isAuth = pathname.startsWith('/auth')
  const isPending = pathname === '/auth/pending'
  const isPublic = pathname.startsWith('/investor')

  // Not signed in → bounce to login (except for auth pages and public investor portal)
  if (!session && !isAuth && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Signed in → enforce status-based gate
  if (session) {
    // Check user status from public.users
    const { data: profile } = await supabase
      .from('users')
      .select('status, role')
      .eq('id', session.user.id)
      .single()

    const status = (profile as { status?: string; role?: string } | null)?.status
    const role   = (profile as { status?: string; role?: string } | null)?.role

    if (status === 'pending' && !isPending && !isAuth) {
      return NextResponse.redirect(new URL('/auth/pending', request.url))
    }
    if (status === 'disabled') {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/auth/login?error=Account+disabled', request.url))
    }

    // Admin-only routes
    if (pathname.startsWith('/admin') && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Signed-in active users on auth pages → forward to dashboard
    if (isAuth && !pathname.startsWith('/auth/callback') && status === 'active') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
