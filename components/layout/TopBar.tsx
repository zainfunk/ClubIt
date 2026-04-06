'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Bell, Settings } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import Avatar from '@/components/Avatar'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'My Clubs',
  '/clubs':      'Campus Curator',
  '/events':     'Events',
  '/chat':       'Chat',
  '/elections':  'Elections',
  '/profile':    'Profile',
  '/admin':      'Admin',
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

  return (
    <header className="fixed top-0 left-64 right-0 h-16 glass-nav bg-white/80 flex justify-between items-center px-8 z-40 border-b border-slate-100/80">
      <h1
        className="text-xl font-black tracking-tighter text-slate-900"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        {title}
      </h1>
      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-full text-sm focus:ring-2 focus:ring-[#0058be]/20 w-64 transition-all outline-none"
            placeholder="Search clubs, events..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <Bell className="w-5 h-5 cursor-pointer hover:text-[#0058be] transition-colors" />
          <Link href="/settings" data-tour-id="tour-settings">
            <Settings className="w-5 h-5 cursor-pointer hover:text-[#0058be] transition-colors" />
          </Link>
          <Link href="/profile">
            <Avatar name={currentUser.name} size="sm" />
          </Link>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>
    </header>
  )
}
