
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 1. Check authentication
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }

    // 2. Check admin authorization (user_level = 10)
    // Avoid checking for the login page itself to prevent infinite loops if we were to protect it (but /admin/login is public usually)
    // However, the check above redirects TO /admin/login if not logged in.
    // If logged in, we verify level.
    if (request.nextUrl.pathname === '/admin/login') {
      // If already logged in as admin, redirect to dashboard? 
      // Let's implement that logic in the page itself or here if needed.
      // For now, let's focus on protecting non-public admin routes.
    } 
    
    // We strictly protect everything under /admin except /admin/login
    if (request.nextUrl.pathname !== '/admin/login') {
       const { data: profile } = await supabase
        .from('profiles')
        .select('user_level')
        .eq('id', user.id)
        .single()

      if (!profile || profile.user_level !== 10) {
        // Not an admin, redirect to home
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return NextResponse.redirect(url)
      }
    }
  }


  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/admin/login') && // Allow access to admin login
    // Allow public access to home and resources
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/_next') &&
    !request.nextUrl.pathname.startsWith('/public') 
  ) {
    // no user, potentially redirect to login
    // For now, we allow reading but maybe restrict writing later
    // url.pathname = '/login'
    // return NextResponse.redirect(url)
  }

  return supabaseResponse
}
