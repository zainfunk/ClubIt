'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Settings, Database } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import Avatar from '@/components/Avatar'
import NotificationBell from '@/components/NotificationBell'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'My Clubs',
  '/clubs':      'Campus Curator',
  '/events':     'Events',
  '/chat':       'Chat',
  '/elections':  'Elections',
  '/profile':    'Profile',
  '/admin':      'Admin',
  '/dev/school-lab': 'School Lab',
  '/demo':       'Demo Data',
  '/settings':   'Settings',
}

function usePageTitle(pathname: string) {
  const entry = Object.entries(PAGE_TITLES).find(([key]) => pathname === key || pathname.startsWith(key + '/'))
  return entry?.[1] ?? 'Campus Curator'
}

export default function TopBar() {
  const { currentUser } = useMockAuth()
  const pathname = usePathname()
  const title = usePageTitle(pathname)
  const showDevTools = process.env.NODE_ENV === 'development'

  return (
    <header className="fixed top-0 left-64 right-0 h-16 glass-nav bg-white/80 flex justify-between items-center px-8 z-40 border-b border-slate-100/80">
      <h1
        className="text-xl font-black tracking-tighter text-slate-900"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        {title}
      </h1>
      <div className="flex items-center gap-6">
        {showDevTools && (
          <Link
            href="/dev/school-lab"
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
              pathname === '/dev/school-lab'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            School Lab
          </Link>
        )}
        <Link
          href="/demo"
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            pathname === '/demo'
              ? 'bg-[#0058be] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Demo Data
        </Link>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-full text-sm focus:ring-2 focus:ring-[#0058be]/20 w-64 transition-all outline-none"
            placeholder="Search clubs, events..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <NotificationBell />
          <Link href="/settings" data-tour-id="tour-settings">
            <Settings className="w-5 h-5 cursor-pointer hover:text-[#0058be] transition-colors" />
          </Link>
          <Link href="/profile">
            <Avatar name={currentUser.name} size="sm" />
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  )
}
