'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { Role } from '@/types'
import { GraduationCap, LayoutDashboard, Calendar, FileText, Compass, User, ShieldCheck, MessageSquare, Settings, ChevronDown } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { HelpButton } from '@/components/HelpTour'
import { useState, useRef, useEffect } from 'react'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700',
  advisor: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
}

const NAV_ITEMS = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'My Clubs',       roles: ['student', 'advisor'],           tourId: 'tour-nav-dashboard' },
  { href: '/events',     icon: Calendar,        label: 'Events',          roles: ['student', 'advisor', 'admin'],  tourId: 'tour-nav-events' },
  { href: '/chat',       icon: MessageSquare,   label: 'Chat',            roles: ['student', 'advisor', 'admin'],  tourId: 'tour-nav-chat' },
  { href: '/elections',  icon: FileText,        label: 'Elections',       roles: ['student', 'advisor', 'admin'],  tourId: 'tour-nav-elections' },
  { href: '/clubs',      icon: Compass,         label: 'All Clubs',       roles: ['student', 'advisor', 'admin'],  tourId: 'tour-nav-clubs' },
  { href: '/profile',    icon: User,            label: 'Profile',         roles: ['student', 'advisor', 'admin'],  tourId: 'tour-nav-profile' },
  { href: '/admin',      icon: ShieldCheck,     label: 'Admin',           roles: ['admin'],                        tourId: 'tour-nav-admin' },
]

const ROLE_OPTIONS = [
  { value: '', label: '— My Role —' },
  { value: 'student', label: 'Student' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'admin', label: 'Admin' },
]

export default function Sidebar() {
  const { currentUser, schoolName, devRole, setDevRole } = useMockAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [roleOpen, setRoleOpen] = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setRoleOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
        {currentUser.role !== 'admin' && <HelpButton />}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-200/50 pt-6 space-y-3 px-4">
        <div className="flex items-center gap-3">
          <Link href="/profile" className="shrink-0">
            <Avatar name={currentUser.name} size="sm" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate leading-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
              {currentUser.name}
            </p>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${ROLE_BADGE[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </div>

        {/* Dev: role override for UI testing (your identity/data never changes) */}
        <div ref={roleRef} className="relative">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Preview Role (Dev)</p>
          <button
            onClick={() => setRoleOpen((v) => !v)}
            className="w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5 cursor-pointer text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <span>{ROLE_OPTIONS.find((o) => o.value === (devRole ?? ''))?.label ?? '— My Role —'}</span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
          {roleOpen && (
            <div className="fixed z-[200] w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
              style={{
                bottom: '6rem',
                left: '1rem',
              }}
            >
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setDevRole((opt.value as Role) || null)
                    setRoleOpen(false)
                    router.push('/')
                  }}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-slate-50 ${
                    (devRole ?? '') === opt.value ? 'text-[#0058be] font-bold' : 'text-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
