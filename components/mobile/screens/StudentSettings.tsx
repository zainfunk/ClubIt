'use client'

// Settings (route: /settings, phone + student/advisor). Per-user privacy
// controls + sign-out.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import {
  fetchUserPrivacy, persistUserPrivacy, type UserPrivacySettings,
  fetchAdminSettings, type AdminSettings,
} from '@/lib/settings-store'
import { css, TOP, BOTTOM, avBg, initials } from '../css'
import { Loader } from '../primitives'
import { useToast } from '../toast'
import AccountActions from '../AccountActions'

type Key = keyof UserPrivacySettings
type AdminGate = keyof Pick<AdminSettings, 'clubsFeatureEnabled' | 'achievementsFeatureEnabled' | 'attendanceFeatureEnabled'>
const PRIVACY: { key: Key; gate: AdminGate; bg: string; stroke: string; icon: React.ReactNode; title: string; sub: string; lockedNote: string }[] = [
  { key: 'clubsPublic',        gate: 'clubsFeatureEnabled',        bg: '#eef0ff', stroke: '#6366f1', icon: <><circle cx="12" cy="12" r="9" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" /></>,                    title: 'Show my clubs',     sub: 'Let others see clubs you’re in',  lockedNote: 'Disabled by admin — club visibility is turned off school-wide.' },
  { key: 'achievementsPublic', gate: 'achievementsFeatureEnabled', bg: '#fdecf2', stroke: '#ec4899', icon: <><circle cx="12" cy="8" r="5" /><path d="M8.2 12 7 22l5-3 5 3-1.2-10" /></>,                                   title: 'Show achievements', sub: 'Display badges on your profile',  lockedNote: 'Disabled by admin — achievement visibility is turned off school-wide.' },
  { key: 'attendancePublic',   gate: 'attendanceFeatureEnabled',   bg: '#e8faf2', stroke: '#10b981', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></>,         title: 'Show attendance',   sub: 'Share your attendance record',    lockedNote: 'Disabled by admin — attendance visibility is turned off school-wide.' },
]

export default function StudentSettings() {
  const { currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const { signOut } = useClerk()
  const [privacy, setPrivacy] = useState<UserPrivacySettings | null>(null)
  const [admin, setAdmin] = useState<AdminSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchUserPrivacy(currentUser.id), fetchAdminSettings()]).then(([p, a]) => {
      if (cancelled) return
      setPrivacy(p)
      setAdmin(a)
    })
    return () => { cancelled = true }
  }, [currentUser.id])

  function toggle(key: Key, gate: AdminGate) {
    if (admin && !admin[gate]) {
      toast('Disabled by your school admin')
      return
    }
    setPrivacy(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: !prev[key] }
      void persistUserPrivacy(currentUser.id, { [key]: next[key] })
      return next
    })
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Settings</div></div>
      {privacy === null || admin === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:13px;box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:18px;')}>
            <span style={{ ...css("width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:17px;color:#fff;flex:none;"), background: avBg(currentUser.name || 'Me') }}>{initials(currentUser.name || 'Me')}</span>
            <div style={css('flex:1;min-width:0;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;")}>{currentUser.name}</div><div style={css('font-size:12px;color:#9aa0ac;font-weight:500;')}>{schoolName || 'Your school'}</div></div>
          </div>

          <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:0 4px 9px;')}>Privacy</div>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {PRIVACY.map((f, i) => {
              const locked = !admin[f.gate]
              return (
                <div key={f.key}>
                  <div style={css(`display:flex;align-items:center;gap:12px;padding:13px 0;${(i < PRIVACY.length - 1 && !locked) ? 'border-bottom:1px solid #f4f5f7;' : ''}${locked ? 'opacity:.55;' : ''}`)}>
                    <span style={css(`width:34px;height:34px;border-radius:10px;background:${f.bg};display:flex;align-items:center;justify-content:center;flex:none;`)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={f.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg></span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{f.title}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{f.sub}</div></div>
                    <button disabled={locked} onClick={() => toggle(f.key, f.gate)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:${locked ? 'not-allowed' : 'pointer'};position:relative;flex:none;background:${locked ? '#d4d5db' : (privacy[f.key] ? '#10b981' : '#d4d5db')};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${(!locked && privacy[f.key]) ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
                  </div>
                  {locked && (
                    <div style={css(`display:flex;align-items:center;gap:7px;padding:0 0 11px 46px;font-size:11px;color:#b45309;${i < PRIVACY.length - 1 ? 'border-bottom:1px solid #f4f5f7;margin-bottom:0;padding-bottom:13px;' : ''}`)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                      <span>{f.lockedNote}</span>
                    </div>
                  )}
                </div>
              )
            })}
            {!admin.studentSocialsEnabled && (
              <div style={css('display:flex;align-items:center;gap:7px;padding:11px 0 13px 46px;font-size:11px;color:#b45309;border-top:1px solid #f4f5f7;')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                <span>Personal social links are disabled by admin.</span>
              </div>
            )}
          </div>

          <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:20px 4px 9px;')}>Account</div>
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            <button onClick={() => router.push('/profile')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#eef0ff;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>My profile</span><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5cad3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg></button>
            <AccountActions />
            <button onClick={() => { toast('Signing out…'); void signOut(() => router.push('/')) }} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-top:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#fff1f2;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#ef4444;')}>Sign out</span></button>
          </div>
          <div style={css('text-align:center;font-size:11px;color:#b3b9c4;font-weight:500;margin-top:20px;')}>ClubIt</div>
        </div>
      )}
    </div>
  )
}
