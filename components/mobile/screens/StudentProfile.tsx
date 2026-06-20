'use client'

// Student profile (route: /students/[id], phone + admin). Live via
// /api/school/users/[id] (service-role; reliable on the phone shell).

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolUser } from '@/lib/school-api'
import type { Club, User } from '@/types'
import { css, TOP, avBg, clubIcon } from '../css'
import { BackButton, Loader } from '../primitives'

export default function StudentProfile() {
  const params = useParams<{ id: string }>()
  const studentId = params?.id
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!actualUser.id || !studentId) return
    let cancelled = false
    apiSchoolUser(studentId)
      .then(({ user, memberClubs, advisingClubs }) => {
        if (cancelled) return
        setUser(user)
        setClubs([...memberClubs, ...advisingClubs])
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [actualUser.id, studentId])

  const myClubs = useMemo(() => clubs
    .filter(c => studentId && c.memberIds.includes(studentId))
    .map(c => {
      const pos = c.leadershipPositions.find(p => p.userId === studentId)
      return { id: c.id, name: c.name, icon: clubIcon(c.tags, c.name), role: pos?.title || 'Member' }
    }), [clubs, studentId])

  if (!loaded) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(14), paddingLeft: 16 }}><BackButton onClick={() => router.push('/students')} /></div>
        <Loader />
      </div>
    )
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 16px 0;flex:none;'), paddingTop: TOP(14) }}><BackButton onClick={() => router.push('/students')} /></div>
      <div className="m-noscroll" style={css('flex:1;overflow-y:auto;padding:14px 20px 40px;')}>
        {!user ? (
          <div style={css('padding:60px 0;text-align:center;font-size:14px;color:#9aa0ac;')}>Student not found.</div>
        ) : (
          <>
            <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;')}>
              <span style={css(`width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:var(--font-manrope);background:${avBg(user.name)};box-shadow:0 8px 20px rgba(15,23,42,.15);`)}>{(user.name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:22px;letter-spacing:-.02em;color:#0f1729;margin-top:13px;")}>{user.name}</div>
              <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{user.email}</div>
              <span style={css('font-size:11px;font-weight:800;letter-spacing:.05em;color:#6366f1;background:#eef0ff;padding:5px 12px;border-radius:9px;margin-top:11px;text-transform:uppercase;')}>{user.role}</span>
            </div>
            <div style={css('display:flex;gap:11px;margin-top:22px;')}>
              {[[String(myClubs.length), 'Clubs'], [String(myClubs.filter(c => c.role !== 'Member').length), 'Leader roles']].map(([v, l]) => (
                <div key={l} style={css('flex:1;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:14px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#0f1729;")}>{v}</div><div style={css('font-size:11px;color:#8a8f9a;font-weight:600;margin-top:2px;')}>{l}</div></div>
              ))}
            </div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;margin:22px 4px 11px;")}>Clubs &amp; roles</div>
            <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              {myClubs.length === 0 ? <div style={css('padding:18px 0;text-align:center;font-size:13px;color:#9aa0ac;')}>Not in any clubs yet.</div> : myClubs.map((c, i) => (
                <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css(`width:100%;display:flex;align-items:center;gap:11px;padding:12px 0;border:none;background:none;cursor:pointer;text-align:left;${i < myClubs.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                  <span style={css('font-size:22px;width:30px;text-align:center;flex:none;')}>{c.icon}</span>
                  <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{c.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{c.role}</div></div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
