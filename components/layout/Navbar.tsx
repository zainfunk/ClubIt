'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS } from '@/lib/mock-data'
import { GraduationCap, LayoutDashboard, Calendar, FileText, Compass, User, ShieldCheck, MessageSquare } from 'lucide-react'
import Avatar from '@/components/Avatar'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  advisor: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
}

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'My Clubs',       roles: ['student', 'advisor'] },
  { href: '/events',     icon: Calendar,        label: 'Events',          roles: ['student', 'advisor', 'admin'] },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat',            roles: ['student', 'advisor', 'admin'] },
  { href: '/elections',  icon: FileText,        label: 'Elections',       roles: ['student', 'advisor', 'admin'] },
  { href: '/clubs',      icon: Compass,         label: 'All Clubs',       roles: ['student', 'advisor', 'admin'] },
  { href: '/profile',    icon: User,            label: 'Profile',         roles: ['student', 'advisor', 'admin'] },
  { href: '/admin',      icon: ShieldCheck,     label: 'Admin',           roles: ['admin'] },
]

export default function Sidebar() {
  const { currentUser, setCurrentUser } = useMockAuth()
  const pathname = usePathname()
  const router = useRouter()

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(currentUser.role))

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
          <Link href="/">
            <h2
              className="text-lg font-bold text-slate-900 leading-none"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Clubit
            </h2>
          </Link>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest mt-1">
            Academic Curator
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1">
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
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
      </nav>

      {/* User section */}
      <div className="border-t border-slate-200/50 pt-6 space-y-3 px-4">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="shrink-0">
            <Avatar name={currentUser.name} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-slate-900 truncate leading-tight"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {currentUser.name}
            </p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_BADGE[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* User switcher */}
        <select
          value={currentUser.id}
          onChange={(e) => {
            const user = USERS.find((u) => u.id === e.target.value)
            if (user) { setCurrentUser(user); router.push('/') }
          }}
          className="w-full text-xs rounded-lg px-2 py-1.5 cursor-pointer text-slate-500 bg-slate-100 border-none outline-none"
        >
          {USERS.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
          ))}
        </select>
      </div>
    </aside>
  )
}
