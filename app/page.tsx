import { auth, clerkClient } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { isNativeUserAgent } from '@/lib/platform'

// Public marketing landing page. Unauthenticated visitors see the full page.
// Authenticated users are sent to their role-appropriate dashboard.
export default async function RootPage() {
  const { userId } = await auth()
  if (userId) {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const role = user.publicMetadata?.role as string | undefined
    redirect(role === 'superadmin' ? '/superadmin' : '/dashboard')
  }
  // The iOS app should never open onto the marketing page: it shows pricing
  // (Apple anti-steering, Guideline 3.1.1) and a bare marketing landing reads
  // as a repackaged website (Guideline 4.2). Native users go straight to auth.
  if (isNativeUserAgent((await headers()).get('user-agent'))) {
    redirect('/sign-in')
  }
  return <LandingPage />
}
