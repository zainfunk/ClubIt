'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import TopBar from './TopBar'
import MobileTabBar from './MobileTabBar'
import { MobileNavProvider } from './MobileNavContext'
import { useIsPhone } from '@/components/mobile/DeviceProvider'
import { useMockAuth } from '@/lib/mock-auth'
import MobileShell from '@/components/mobile/MobileShell'
import { MOBILE_ROLES } from '@/components/mobile/useIsAdminPhone'

// Pages that should render without the sidebar/topbar shell
const BARE_ROUTES = ['/sign-in', '/sign-up', '/onboard', '/join', '/setup', '/invite', '/school', '/admin/ios']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPhone = useIsPhone()
  const { currentUser } = useMockAuth()
  // The public landing page and checkout flow render bare (no sidebar/topbar).
  const isLanding = pathname === '/' || pathname.startsWith('/landing') || pathname.startsWith('/subscribe')
  // Match exact route or a sub-path — NOT a string prefix, so e.g. the
  // admin "/invites" page is not swallowed by the "/invite" redemption route.
  const isBare = isLanding || BARE_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (isBare) return <>{children}</>

  // Phone-class clients on migrated roles get the new mobile experience.
  if (isPhone && MOBILE_ROLES.includes(currentUser.role)) {
    return (
      <MobileShell role={currentUser.role} userName={currentUser.name}>
        {children}
      </MobileShell>
    )
  }

  return (
    <MobileNavProvider>
      <Navbar />
      <TopBar />
      <main className="ml-0 md:ml-64 mt-14 md:mt-16 min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-4rem)] px-4 sm:px-6 md:px-10 py-6 pb-20 md:py-8 md:pb-8 overflow-y-auto">{children}</main>
      <MobileTabBar />
    </MobileNavProvider>
  )
}
