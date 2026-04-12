import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

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
  return <LandingPage />
}
