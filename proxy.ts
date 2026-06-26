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
  // /setup is the school IT contact's code page — they may not have an account.
  '/setup(.*)',
  '/api/setup/(.*)',
  // NOTE: /join and /onboard (and their APIs) are NOT public — they require a
  // signed-in Clerk user. Clerk redirects unauthenticated visitors to sign-in
  // with a return URL, so they're never stranded on a form they can't submit.
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
