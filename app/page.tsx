'use client'

import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import {
  LayoutDashboard, Calendar, MessageSquare, FileText,
  Compass, User, ShieldCheck, ArrowRight,
} from 'lucide-react'

const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  student:    { bg: 'rgba(16,185,129,0.1)',  text: '#059669' },
  advisor:    { bg: 'rgba(0,88,190,0.1)',    text: '#0058be' },
  admin:      { bg: 'rgba(186,26,26,0.1)',   text: '#ba1a1a' },
  superadmin: { bg: 'rgba(109,40,217,0.1)',  text: '#7c3aed' },
}

type NavCard = {
  href: string
  label: string
  description: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  roles: string[]
}

const NAV_CARDS: NavCard[] = [
  {
    href: '/dashboard',
    label: 'My Clubs',
    description: 'Your clubs, leadership roles, and upcoming meetings.',
    icon: LayoutDashboard,
    iconBg: 'rgba(0,88,190,0.08)',
    iconColor: '#0058be',
    roles: ['student', 'advisor'],
  },
  {
    href: '/events',
    label: 'Events',
    description: 'Browse and discover upcoming events from all clubs.',
    icon: Calendar,
    iconBg: 'rgba(16,185,129,0.08)',
    iconColor: '#059669',
    roles: ['student', 'advisor', 'admin'],
  },
  {
    href: '/chat',
    label: 'Chat',
    description: 'Message members of your clubs in real time.',
    icon: MessageSquare,
    iconBg: 'rgba(109,40,217,0.08)',
    iconColor: '#7c3aed',
    roles: ['student', 'advisor', 'admin'],
  },
  {
    href: '/elections',
    label: 'Forms & Elections',
    description: 'Cast votes, submit forms, and track club decisions.',
    icon: FileText,
    iconBg: 'rgba(146,71,0,0.08)',
    iconColor: '#924700',
    roles: ['student', 'advisor', 'admin'],
  },
  {
    href: '/clubs',
    label: 'All Clubs',
    description: 'Explore every club and find new communities to join.',
    icon: Compass,
    iconBg: 'rgba(79,70,229,0.08)',
    iconColor: '#4338ca',
    roles: ['student', 'advisor', 'admin'],
  },
  {
    href: '/profile',
    label: 'Profile',
    description: 'View and manage your account details and settings.',
    icon: User,
    iconBg: 'rgba(225,29,72,0.08)',
    iconColor: '#e11d48',
    roles: ['student', 'advisor', 'admin'],
  },
  {
    href: '/admin',
    label: 'Admin Panel',
    description: 'Manage clubs, elections, and school-wide settings.',
    icon: ShieldCheck,
    iconBg: 'rgba(186,26,26,0.08)',
    iconColor: '#ba1a1a',
    roles: ['admin'],
  },
]

export default function HomePage() {
  const { currentUser } = useMockAuth()
  const firstName = currentUser.name.split(' ')[0]
  const badge = ROLE_BADGE[currentUser.role] ?? ROLE_BADGE.student
  const cards = currentUser.role === 'superadmin'
    ? [{ href: '/superadmin', label: 'Super Admin', description: 'Manage all schools and tenants.', icon: ShieldCheck, iconBg: 'rgba(109,40,217,0.08)', iconColor: '#7c3aed', roles: ['superadmin'] }]
    : NAV_CARDS.filter((c) => c.roles.includes(currentUser.role))

  return (
    <div className="max-w-2xl mx-auto">
      {/* Welcome header */}
      <div className="text-center mb-12 mt-4">
        <h1
          className="text-[2.75rem] font-extrabold text-[#191c1d] tracking-tight leading-tight mb-3"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Welcome to Clubit
        </h1>
        <div className="flex items-center justify-center gap-2">
          <p className="text-gray-500 text-base">Hi, {firstName}</p>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.text }}
          >
            {currentUser.role}
          </span>
        </div>
      </div>

      {/* Nav cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ href, label, description, icon: Icon, iconBg, iconColor }) => (
          <Link key={href} href={href}>
            <div
              className="group flex items-start gap-5 bg-white rounded-xl p-6 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ background: iconBg }}
              >
                <Icon style={{ color: iconColor, width: '1.25rem', height: '1.25rem' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-bold text-[#191c1d] text-base leading-tight mb-1 group-hover:text-[#0058be] transition-colors"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  {label}
                </h3>
                <p className="text-sm text-gray-500 leading-snug">{description}</p>
              </div>
              <ArrowRight
                className="shrink-0 mt-0.5 text-gray-300 group-hover:text-[#0058be] group-hover:translate-x-1 transition-all"
                style={{ width: '1rem', height: '1rem' }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
