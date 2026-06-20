'use client'

// Profile (route: /profile, phone + admin). The signed-in admin's own profile,
// with live club/student counts.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchSchoolClubs, fetchSchoolUsers } from '@/lib/school-data'
import { css, TOP, BOTTOM, avBg, initials } from '../css'
import { Chevron } from '../primitives'

export default function AdminProfile() {
  const { currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const [clubCount, setClubCount] = useState<number | null>(null)
  const [studentCount, setStudentCount] = useState<number | null>(null)

  useEffect(() => {
    const schoolId = currentUser.schoolId
    if (!schoolId) return
    let cancelled = false
    Promise.all([fetchSchoolClubs(schoolId), fetchSchoolUsers(schoolId)])
      .then(([clubs, users]) => {
        if (cancelled) return
        setClubCount(clubs.length)
        setStudentCount(users.filter(u => u.role === 'student').length)
      })
      .catch(() => { if (!cancelled) { setClubCount(0); setStudentCount(0) } })
    return () => { cancelled = true }
  }, [currentUser.schoolId])

  const stats: [string, string][] = [
    [clubCount === null ? '—' : String(clubCount), 'Clubs'],
    [studentCount === null ? '—' : String(studentCount), 'Students'],
    [currentUser.role === 'superadmin' ? 'Super' : 'Admin', 'Role'],
  ]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 16px 0;flex:none;display:flex;justify-content:flex-end;'), paddingTop: TOP(14) }}>
        <button onClick={() => router.push('/settings')} style={css('width:38px;height:38px;border-radius:50%;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button>
      </div>
      <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:8px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
        <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;')}>
          <span style={css(`width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:var(--font-manrope);background:${avBg(currentUser.name || 'Admin')};box-shadow:0 10px 24px rgba(99,102,241,.3);`)}>{initials(currentUser.name || 'Admin')}</span>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.02em;color:#0f1729;margin-top:13px;")}>{currentUser.name || 'Admin'}</div>
          <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{currentUser.email}{schoolName ? ` · ${schoolName}` : ''}</div>
          <span style={css('font-size:11px;font-weight:800;letter-spacing:.05em;color:#e11d48;background:#ffe4e6;padding:5px 12px;border-radius:9px;margin-top:11px;')}>SCHOOL ADMIN</span>
        </div>
        <div style={css('display:flex;gap:11px;margin-top:22px;')}>
          {stats.map(([v, l]) => (
            <div key={l} style={css('flex:1;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;color:#0f1729;")}>{v}</div><div style={css('font-size:11px;color:#8a8f9a;font-weight:600;margin-top:2px;')}>{l}</div></div>
          ))}
        </div>
        <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);margin-top:18px;')}>
          <button onClick={() => router.push('/admin/moderation')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#fff7e6;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Moderation queue</span><Chevron /></button>
          <button onClick={() => router.push('/settings')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#eef0ff;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Settings</span><Chevron /></button>
        </div>
      </div>
    </div>
  )
}
