'use client'

// Settings (route: /settings, phone + admin). Real school feature toggles via
// the settings store; sign-out via Clerk. Billing is hidden in the native app
// (App Store Guideline 3.1.1).

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchAdminSettings, persistAdminSettings, type AdminSettings } from '@/lib/settings-store'
import { isNativeUserAgent } from '@/lib/platform'
import { css, TOP, BOTTOM } from '../css'
import { Loader } from '../primitives'
import { useToast } from '../toast'
import AccountActions from '../AccountActions'

type Key = keyof AdminSettings
const FEATURES: { key: Key; bg: string; stroke: string; icon: React.ReactNode; title: string; sub: string }[] = [
  { key: 'streaksEnabled', bg: '#fff1e9', stroke: '#f97316', icon: <path d="M12 2c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 9 9 6 12 2z" />, title: 'Streaks', sub: 'Reward consistent attendance' },
  { key: 'attendanceFeatureEnabled', bg: '#e8faf2', stroke: '#10b981', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></>, title: 'Attendance', sub: 'QR check-in at meetings' },
  { key: 'hoursTrackingEnabled', bg: '#f3edff', stroke: '#8b5cf6', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, title: 'Hours tracking', sub: 'Log member service hours' },
  { key: 'achievementsFeatureEnabled', bg: '#fdecf2', stroke: '#ec4899', icon: <><circle cx="12" cy="8" r="5" /><path d="M8.2 12 7 22l5-3 5 3-1.2-10" /></>, title: 'Achievements', sub: 'Badges for milestones' },
  { key: 'studentSocialsEnabled', bg: '#eef0ff', stroke: '#0ea5e9', icon: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></>, title: 'Student socials', sub: 'Allow links on profiles' },
  { key: 'clubsFeatureEnabled', bg: '#eef0f3', stroke: '#64748b', icon: <><circle cx="12" cy="12" r="9" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" /></>, title: 'Clubs directory', sub: 'Let students browse clubs' },
]

export default function AdminSettingsScreen() {
  const { currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const { signOut } = useClerk()
  const [settings, setSettings] = useState<AdminSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminSettings().then(s => { if (!cancelled) setSettings(s) })
    return () => { cancelled = true }
  }, [])

  const isNative = typeof navigator !== 'undefined' && isNativeUserAgent(navigator.userAgent)

  function toggle(key: Key) {
    setSettings(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: !prev[key] }
      void persistAdminSettings({ [key]: next[key] })
      return next
    })
  }

  const schoolInitials = (schoolName || 'School').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Settings</div></div>
      {settings === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:13px;box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:18px;')}>
            <span style={css("width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#10b981);display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:17px;color:#fff;flex:none;")}>{schoolInitials}</span>
            <div style={css('flex:1;min-width:0;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;")}>{schoolName || 'Your school'}</div><div style={css('font-size:12px;color:#9aa0ac;font-weight:500;')}>School administrator</div></div>
          </div>

          <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:0 4px 9px;')}>Features</div>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {FEATURES.map((f, i) => (
              <div key={f.key} style={css(`display:flex;align-items:center;gap:12px;padding:13px 0;${i < FEATURES.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css(`width:34px;height:34px;border-radius:10px;background:${f.bg};display:flex;align-items:center;justify-content:center;flex:none;`)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={f.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg></span>
                <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{f.title}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{f.sub}</div></div>
                <button onClick={() => toggle(f.key)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;flex:none;background:${settings[f.key] ? '#10b981' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${settings[f.key] ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
              </div>
            ))}
          </div>

          <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:20px 4px 9px;')}>Account</div>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            <button onClick={() => router.push('/invites')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#e8faf2;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Invite codes</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5cad3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            {!isNative && (
              <button onClick={() => router.push('/admin/billing')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#f3edff;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Billing &amp; subscription</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5cad3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            )}
            <AccountActions />
            <button onClick={() => { toast('Signing out…'); void signOut(() => router.push('/')) }} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-top:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#fff1f2;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#ef4444;')}>Sign out</span></button>
          </div>
          <div style={css('text-align:center;font-size:11px;color:#b3b9c4;font-weight:500;margin-top:20px;')}>ClubIt · {currentUser.name}</div>
        </div>
      )}
    </div>
  )
}
