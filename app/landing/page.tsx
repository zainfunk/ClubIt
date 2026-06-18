import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import LandingPage from '@/components/landing/LandingPage'
import { isNativeUserAgent } from '@/lib/platform'

// Always-on landing page. Unlike `/`, this route never redirects authed users,
// so the in-app sidebar logo can bring signed-in users here.
export default async function LandingRoute() {
  // No marketing/pricing surface inside the iOS app (Guideline 3.1.1 / 4.2).
  if (isNativeUserAgent((await headers()).get('user-agent'))) {
    redirect('/dashboard')
  }
  return <LandingPage />
}
