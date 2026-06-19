'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import TopBar from './TopBar'
import MobileTabBar from './MobileTabBar'
import { MobileNavProvider } from './MobileNavContext'

// Pages that should render without the sidebar/topbar shell
const BARE_ROUTES = ['/sign-in', '/sign-up', '/onboard', '/join', '/setup', '/invite', '/school']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // The public landing page and checkout flow render bare (no sidebar/topbar).
  const isLanding = pathname === '/' || pathname.startsWith('/landing') || pathname.startsWith('/subscribe')
  const isBare = isLanding || BARE_ROUTES.some(r => pathname.startsWith(r))

  if (isBare) return <>{children}</>

  return (
    <MobileNavProvider>
      <Navbar />
      <TopBar />
      <main className="ml-0 md:ml-64 mt-14 md:mt-16 min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] px-4 sm:px-6 md:px-10 py-6 pb-20 md:py-8 md:pb-8 overflow-y-auto">{children}</main>
      <MobileTabBar />
    </MobileNavProvider>
  )
}
