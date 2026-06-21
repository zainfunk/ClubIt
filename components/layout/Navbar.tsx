'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import { LayoutDashboard, Calendar, FileText, Compass, User, ShieldCheck, MessageSquare, Settings, LogOut, Globe, X, Flag } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { HelpButton } from '@/components/HelpTour'
import { useEffect } from 'react'
import { useMobileNav } from './MobileNavContext'

const NAV_ITEMS = [
  { href: '/superadmin', icon: Globe,           label: 'Schools',    roles: ['superadmin'],                                tourId: 'tour-nav-superadmin' },
  { href: '/dashboard',  icon: LayoutDashboard, label: 'My Clubs',   roles: ['student', 'advisor'],                         tourId: 'tour-nav-dashboard' },
  { href: '/events',     icon: Calendar,        label: 'Events',     roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-events' },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat',       roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-chat' },
  { href: '/elections',  icon: FileText,        label: 'Elections',  roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-elections' },
  { href: '/clubs',      icon: Compass,         label: 'All Clubs',  roles: ['student', 'advisor', 'admin'],                tourId: 'tour-nav-clubs' },
  { href: '/profile',    icon: User,            label: 'Profile',    roles: ['student', 'advisor', 'admin', 'superadmin'],  tourId: 'tour-nav-profile' },
  { href: '/admin',      icon: ShieldCheck,     label: 'Admin',      roles: ['admin'],                                      tourId: 'tour-nav-admin' },
  { href: '/admin/moderation', icon: Flag,      label: 'Moderation', roles: ['admin'],                                      tourId: 'tour-nav-moderation' },
]

export default function Sidebar() {
  const { actualUser, schoolName } = useMockAuth()
  const { signOut } = useClerk()
  const pathname = usePathname()
  // Drawer open state is shared with the MobileTabBar "More" button.
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav()

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(actualUser.role))

  function isActive(href: string) {
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    if (href === '/clubs') return pathname === '/clubs' || pathname.startsWith('/clubs/')
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-slate-100/80">
        <Link href="/landing" className="flex items-center gap-2.5 group">
          <img
            src="/clubit-logo.png"
            alt="ClubIt"
            className="w-11 h-11 rounded-lg object-contain group-hover:scale-105 transition-transform"
          />
          <div>
            <span
              className="text-base font-extrabold tracking-tight text-slate-900 leading-none block"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              ClubIt
            </span>
            <span className="text-[9px] text-slate-400 font-medium truncate max-w-[130px] block leading-tight mt-0.5">
              {schoolName ?? 'School Hub'}
            </span>
          </div>
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {visibleItems.map(({ href, icon: Icon, label, tourId }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              data-tour-id={tourId}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? 'text-indigo-700 bg-indigo-50/80 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{label}</span>
            </Link>
          )
        })}

        <Link
          href="/settings"
          data-tour-id="tour-nav-settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
            pathname === '/settings'
              ? 'text-indigo-700 bg-indigo-50/80 font-semibold'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          <span>Settings</span>
        </Link>

        {actualUser.role !== 'admin' && <HelpButton />}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-100 px-3 py-3 shrink-0">
        <div className="flex items-center gap-2.5 px-2">
          <Link href="/profile" className="shrink-0">
            <Avatar name={actualUser.name} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              {actualUser.name}
            </p>
            <span className="text-[10px] font-semibold text-slate-400 capitalize">{actualUser.role}</span>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: '/sign-in' })}
            className="shrink-0 p-1.5 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200/60 flex-col z-50"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200/60 flex flex-col shadow-2xl"
            style={{
              fontFamily: 'var(--font-inter)',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
