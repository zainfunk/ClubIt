import LandingPage from '@/components/landing/LandingPage'

// Always-on landing page. Unlike `/`, this route never redirects authed users,
// so the in-app sidebar logo can bring signed-in users here.
export default function LandingRoute() {
  return <LandingPage />
}
