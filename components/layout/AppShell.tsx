'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import TopBar from './TopBar'

// Pages that should render without the sidebar/topbar shell
const BARE_ROUTES = ['/sign-in', '/sign-up', '/onboard', '/join', '/setup', '/invite', '/superadmin', '/school']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // The public landing page renders bare (no sidebar/topbar) at both "/" and "/landing".
  const isLanding = pathname === '/' || pathname.startsWith('/landing')
  const isBare = isLanding || BARE_ROUTES.some(r => pathname.startsWith(r))

  if (isBare) return <>{children}</>

  return (
    <>
      <Navbar />
      <TopBar />
      <main className="ml-64 pt-16 min-h-screen px-8 py-8 overflow-y-auto">{children}</main>
    </>
  )
}
