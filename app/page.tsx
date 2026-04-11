import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'

// Public marketing landing page. Unauthenticated visitors see the full page.
// Authenticated users are sent straight to their dashboard.
// Core features (browse clubs, sign up, admin panel, etc.) live behind /dashboard, /clubs, /admin, etc.
export default async function RootPage() {
  const { userId } = await auth()
  if (userId) redirect('/dashboard')
  return <LandingPage />
}
