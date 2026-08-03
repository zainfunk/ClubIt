import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/landing(.*)',
  '/subscribe(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sso-callback(.*)',
  '/privacy',
  '/terms',
  '/support',
  '/contact',
  '/api/contact',
  // /setup is the school IT contact's code page — they may not have an account.
  '/setup(.*)',
  '/api/setup/(.*)',
  // Open-registration join pages (e.g. /join/uconn) are public so a prospective
  // UConn student can see the school + register CTA BEFORE signing in; the page
  // itself shows a "Sign in to continue" prompt when signed out. The GET on
  // /api/registrations returns only public school info to anon callers, while
  // its POST/PATCH self-enforce auth. Note: bare /join (the invite-code page)
  // and /onboard are deliberately left OUT — those still require a signed-in
  // Clerk user and bounce anon visitors to sign-in with a return URL.
  '/join/(.*)',
  '/api/registrations',
  // /api/webhooks/* removed in W2.6 -- duplicate Stripe handler that
  // accepted unsigned events when STRIPE_WEBHOOK_SECRET was unset (C-6).
  '/api/stripe/webhook',
])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return NextResponse.next()

  // For API routes, return a proper JSON response instead of redirecting
  // to the sign-in page (which results in an HTML page the client can't parse).
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  if (isApiRoute) {
    try {
      const { userId } = await auth()
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
