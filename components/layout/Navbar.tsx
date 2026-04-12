'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import { GraduationCap, LayoutDashboard, Calendar, FileText, Compass, User, ShieldCheck, MessageSquare, Settings, LogOut, Globe } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { HelpButton } from '@/components/HelpTour'

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin:   'bg-red-100 text-red-700',
  advisor: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
}

const NAV_ITEMS = [
  { href: '/superadmin', icon: Globe,           label: 'Schools',         roles: ['superadmin'],                                tourId: 'tour-nav-superadmin' },
  { href: '/dashboard',  icon: LayoutDashboard, label: 'My Clubs',       roles: ['student', 'advisor'],                         tourId: 'tour-nav-dashboard' },
  { href: '/events',     icon: Calendar,        label: 'Events',          roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-events' },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat',            roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-chat' },
  { href: '/elections',  icon: FileText,        label: 'Elections',       roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-elections' },
  { href: '/clubs',      icon: Compass,         label: 'All Clubs',       roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-clubs' },
  { href: '/profile',    icon: User,            label: 'Profile',         roles: ['student', 'advisor', 'admin', 'superadmin'],  tourId: 'tour-nav-profile' },
  { href: '/admin',      icon: ShieldCheck,     label: 'Admin',           roles: ['admin'],                                      tourId: 'tour-nav-admin' },
]

export default function Sidebar() {
  const { actualUser, schoolName } = useMockAuth()
  const { signOut } = useClerk()
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(actualUser.role))

  function isActive(href: string) {
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    if (href === '/clubs') return pathname === '/clubs' || pathname.startsWith('/clubs/')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-50 border-r border-slate-200/40 flex flex-col py-8 px-4 z-50">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 mb-10">
        <div className="w-10 h-10 rounded-full bg-[#0058be] flex items-center justify-center text-white shrink-0">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <Link href="/dashboard">
            <h2
              className="text-lg font-bold text-slate-900 leading-none"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Clubit
            </h2>
          </Link>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1 truncate max-w-[140px]">
            {schoolName ?? 'Academic Curator'}
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {visibleItems.map(({ href, icon: Icon, label, tourId }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              data-tour-id={tourId}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
                active
                  ? 'text-[#0058be] font-bold bg-blue-50/60 border-r-4 border-[#0058be]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon
                className="shrink-0"
                style={{ width: '1.1rem', height: '1.1rem' }}
              />
              <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
            </Link>
          )
        })}

        {/* Settings link */}
        <Link
          href="/settings"
          data-tour-id="tour-nav-settings"
          className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ${
            pathname === '/settings'
              ? 'text-[#0058be] font-bold bg-blue-50/60 border-r-4 border-[#0058be]'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings style={{ width: '1.1rem', height: '1.1rem' }} className="shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-widest">Settings</span>
        </Link>

        {/* Help button — only shown for non-admin */}
        {actualUser.role !== 'admin' && <HelpButton />}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-200/50 pt-6 space-y-3 px-4">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="shrink-0">
            <Avatar name={actualUser.name} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              {actualUser.name}
            </p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_BADGE[actualUser.role]}`}>
              {actualUser.role}
            </span>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
