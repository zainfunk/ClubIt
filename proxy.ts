import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/landing(.*)',
  '/subscribe(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboard(.*)',
  '/setup(.*)',
  '/invite(.*)',
  '/join',
  '/api/invite/(.*)',
  '/api/setup/(.*)',
  '/api/join',
  '/api/onboard',
  '/api/webhooks/(.*)',
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
