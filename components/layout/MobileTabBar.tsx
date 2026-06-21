'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, Compass, User, Menu } from 'lucide-react'
import { useMobileNav } from './MobileNavContext'

const TABS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'My Clubs' },
  { href: '/chat',      icon: MessageSquare,   label: 'Chat' },
  { href: '/clubs',     icon: Compass,         label: 'Clubs' },
  { href: '/profile',   icon: User,            label: 'Profile' },
] as const

// Routes that live behind the "More" drawer rather than a dedicated tab. When
// the user is on one of these, the More button shows as active.
const MORE_ROUTES = ['/settings', '/elections', '/events', '/admin']

export default function MobileTabBar() {
  const pathname = usePathname()
  const { open, setOpen } = useMobileNav()

  function isActive(href: string) {
    if (href === '/profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    if (href === '/clubs') return pathname === '/clubs' || pathname.startsWith('/clubs/')
    return pathname === href || pathname.startsWith(href + '/')
  }

  const moreActive = open || MORE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))

  const tabClass = (active: boolean) =>
    `flex flex-1 h-full flex-col items-center justify-center gap-0.5 min-w-0 px-1 touch-manipulation transition-colors ${
      active ? 'text-indigo-600' : 'text-slate-400'
    }`

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', fontFamily: 'var(--font-inter)' }}
    >
      <div className="flex items-stretch justify-around h-14">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href} className={tabClass(active)}>
              <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] leading-tight truncate ${active ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="More"
          aria-expanded={open}
          className={tabClass(moreActive)}
        >
          <Menu className="w-5 h-5 shrink-0" strokeWidth={moreActive ? 2.5 : 2} />
          <span className={`text-[10px] leading-tight truncate ${moreActive ? 'font-semibold' : 'font-medium'}`}>
            More
          </span>
        </button>
      </div>
    </nav>
  )
}
