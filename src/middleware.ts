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

  // Use getSession (reads JWT from cookie, no network call) for middleware route protection.
  // Individual API routes use getUser() for verified server-side checks.
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isAuth = pathname.startsWith('/auth')
  const isPublic = pathname.startsWith('/investor')

  if (!session && !isAuth && !isPublic) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  if (session && isAuth) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  // Exclude: Next.js internals, static files, API routes (they auth themselves), and favicon
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
