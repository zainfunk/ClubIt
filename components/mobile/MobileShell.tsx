'use client'

// The phone chrome: a full-screen container, the design's bottom tab bar, and
// the "More" sheet. Rendered by AppShell in place of the desktop sidebar/topbar
// for phone-class clients. Navigation targets real routes so back-swipe, the
// Capacitor hardware back button, deep links and push-notification taps all work.

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Role } from '@/types'
import { css, BOTTOM, TABBAR_SPACE } from './css'
import { GlobalMobileStyles, Chevron } from './primitives'
import { ToastProvider } from './toast'

type IconPath = React.ReactNode
interface Tab { key: string; label: string; href: string; icon: IconPath; badge?: number }
interface MoreItem { label: string; href: string; bg: string; stroke: string; icon: IconPath; badge?: number }

const ICONS = {
  home: <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  clubs: <><circle cx="12" cy="12" r="9" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" /></>,
  students: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  more: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  vote: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />,
  trophy: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0zM8 21h8M12 15v6" />,
  shield: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />,
  invite: <path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
}

function tabsFor(role: Role): Tab[] {
  if (role === 'admin' || role === 'superadmin') {
    return [
      { key: 'home', label: 'Home', href: '/dashboard', icon: ICONS.home },
      { key: 'clubs', label: 'Clubs', href: '/clubs', icon: ICONS.clubs },
      { key: 'students', label: 'Students', href: '/students', icon: ICONS.students },
      { key: 'chat', label: 'Chat', href: '/chat', icon: ICONS.chat },
    ]
  }
  // advisor / student (Phase 4 will refine) — keep a sensible default set.
  return [
    { key: 'home', label: 'My Clubs', href: '/dashboard', icon: ICONS.home },
    { key: 'clubs', label: 'Clubs', href: '/clubs', icon: ICONS.clubs },
    { key: 'chat', label: 'Chat', href: '/chat', icon: ICONS.chat },
  ]
}

function moreItemsFor(role: Role): MoreItem[] {
  const base: MoreItem[] = [
    { label: 'Events', href: '/events', bg: '#fff1e9', stroke: '#f59e0b', icon: ICONS.calendar },
    { label: 'Elections', href: '/elections', bg: '#f3edff', stroke: '#8b5cf6', icon: ICONS.vote },
    { label: 'Leaderboard', href: '/leaderboard', bg: '#fff7e6', stroke: '#f59e0b', icon: ICONS.trophy },
  ]
  if (role === 'admin' || role === 'superadmin') {
    base.unshift({ label: 'Admin dashboard', href: '/admin', bg: '#eef0ff', stroke: '#6366f1', icon: ICONS.grid })
    base.push(
      { label: 'Moderation', href: '/admin/moderation', bg: '#fff1f2', stroke: '#ef4444', icon: ICONS.shield },
      { label: 'Invite codes', href: '/invites', bg: '#e8faf2', stroke: '#10b981', icon: ICONS.invite },
    )
  }
  base.push({ label: 'Settings', href: '/settings', bg: '#eef0f3', stroke: '#64748b', icon: ICONS.settings })
  return base
}

// Detail routes render full-bleed without the tab bar (they have their own back).
function isDetailRoute(pathname: string): boolean {
  return /^\/(clubs|chat|students|profile|elections|events)\/.+/.test(pathname)
}

export default function MobileShell({ role, userName, children }: { role: Role; userName?: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const tabs = tabsFor(role)
  const moreItems = moreItemsFor(role)
  const showTabBar = !isDetailRoute(pathname)

  const activeKey = (() => {
    if (pathname.startsWith('/dashboard')) return 'home'
    if (pathname.startsWith('/clubs')) return 'clubs'
    if (pathname.startsWith('/students')) return 'students'
    if (pathname.startsWith('/chat')) return 'chat'
    return 'more'
  })()
  const moreActive = moreOpen || !tabs.some(t => t.key === activeKey)

  const go = (href: string) => { setMoreOpen(false); router.push(href) }
  const tabColor = (on: boolean) => (on ? '#6366f1' : '#9aa0ac')
  const tabW = (on: boolean) => (on ? '2.5' : '2')

  return (
    <ToastProvider>
      <GlobalMobileStyles />
      <div style={css('position:fixed;inset:0;background:#f2f2f7;font-family:var(--font-inter),system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden;')}>
        {/* Mobile screens fill inset:0 and scroll internally; desktop-flow pages
            (e.g. /admin) scroll via this container's overflow-y:auto. */}
        <div style={css('flex:1;position:relative;overflow-y:auto;overflow-x:hidden;')}>{children}</div>

        {showTabBar && (
          <div style={{ ...css('flex:none;z-index:70;background:rgba(248,248,250,.86);backdrop-filter:blur(20px);border-top:1px solid #e2e2e8;'), paddingBottom: BOTTOM(14) }}>
            <div style={css('display:flex;align-items:stretch;height:52px;')}>
              {tabs.map(t => {
                const on = activeKey === t.key
                return (
                  <button key={t.key} onClick={() => go(t.href)} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;position:relative;color:${tabColor(on)};`)}>
                    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(on)} strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                    <span style={css('font-size:10px;font-weight:600;')}>{t.label}</span>
                    {t.badge ? <span style={css('position:absolute;top:1px;right:50%;margin-right:-17px;min-width:16px;height:16px;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;')}>{t.badge}</span> : null}
                  </button>
                )
              })}
              <button onClick={() => setMoreOpen(true)} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(moreActive)};`)}>
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(moreActive)} strokeLinecap="round" strokeLinejoin="round">{ICONS.more}</svg>
                <span style={css('font-size:10px;font-weight:600;')}>More</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {moreOpen && (
        <div style={css('position:fixed;inset:0;z-index:120;')}>
          <div onClick={() => setMoreOpen(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
          <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 16px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(34) }}>
            <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 14px;')} />
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;')}>
              {moreItems.map(m => (
                <button key={m.href} onClick={() => go(m.href)} style={css('background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;display:flex;align-items:center;gap:11px;cursor:pointer;text-align:left;position:relative;')}>
                  <span style={css(`width:38px;height:38px;border-radius:11px;background:${m.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg></span>
                  <span style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{m.label}</span>
                  {m.badge ? <span style={css('position:absolute;top:12px;right:12px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;')}>{m.badge}</span> : null}
                </button>
              ))}
            </div>
            <button onClick={() => go('/profile')} style={css('width:100%;margin-top:11px;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:13px 15px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left;')}>
              <span style={css("width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#10b981);color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);display:flex;align-items:center;justify-content:center;")}>
                {(userName || 'Me').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{userName || 'My profile'}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>View profile · {role === 'superadmin' ? 'Super admin' : role.charAt(0).toUpperCase() + role.slice(1)}</div></div>
              <Chevron size={18} />
            </button>
          </div>
        </div>
      )}
    </ToastProvider>
  )
}

export { TABBAR_SPACE }
