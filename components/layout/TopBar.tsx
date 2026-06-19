'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, Database, ArrowLeftRight } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import NotificationBell from '@/components/NotificationBell'
import GlobalSearch from '@/components/layout/GlobalSearch'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':      'My Clubs',
  '/clubs':          'All Clubs',
  '/events':         'Events',
  '/chat':           'Chat',
  '/elections':      'Elections & Forms',
  '/profile':        'Profile',
  '/admin/moderation': 'Moderation',
  '/admin':          'Admin Panel',
  '/dev/school-lab': 'School Lab',
  '/demo':           'Demo Data',
  '/settings':       'Settings',
  '/superadmin':     'Schools',
}

function usePageTitle(pathname: string) {
  // Check longest match first so nested paths win over their parents.
  const sorted = Object.entries(PAGE_TITLES).sort((a, b) => b[0].length - a[0].length)
  const entry = sorted.find(([key]) => pathname === key || pathname.startsWith(key + '/'))
  return entry?.[1] ?? 'ClubIt'
}

export default function TopBar() {
  const { currentUser, switchSchool, schoolName } = useMockAuth()
  const pathname = usePathname()
  const title = usePageTitle(pathname)
  const showDevTools = process.env.NODE_ENV === 'development'

  return (
    <header
      className="fixed top-0 left-0 md:left-64 right-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 z-40"
      // paddingTop carries the notch / Dynamic Island inset. A fixed element is
      // positioned against the viewport, so it ignores the body's safe-area
      // padding — without this the header renders under the status bar on
      // notched iPhones. The blurred background fills up under the notch; the
      // inner row keeps its normal height below it.
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', fontFamily: 'var(--font-inter)' }}
    >
      <div className="h-14 md:h-16 flex justify-between items-center px-4 md:px-8">
      <h1
        className="text-base md:text-lg font-bold tracking-tight text-slate-900 truncate"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        {title}
      </h1>
      <div className="flex items-center gap-2 md:gap-3">
        {showDevTools && (
          <Link
            href="/dev/school-lab"
            className={`hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === '/dev/school-lab'
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            <Database className="w-3 h-3" />
            Lab
          </Link>
        )}
        {currentUser.role !== 'superadmin' && <GlobalSearch />}
        {schoolName && currentUser.role !== 'superadmin' && (
          <button
            onClick={switchSchool}
            className="hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Switch schools"
          >
            <ArrowLeftRight className="w-3 h-3" />
            Switch School
          </button>
        )}
        <div className="flex items-center gap-1.5 md:gap-2 text-slate-400">
          <NotificationBell />
          <Link href="/settings" data-tour-id="tour-settings" className="flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <Settings className="w-4 h-4" />
          </Link>
          <UserButton />
        </div>
      </div>
      </div>
    </header>
  )
}
