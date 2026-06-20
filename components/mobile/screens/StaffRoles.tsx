'use client'

// Staff & roles (route: /admin/staff, phone + admin). Promote members to
// advisor/admin via POST /api/school/users/[id]/role.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolUsers } from '@/lib/school-api'
import type { Role, User } from '@/types'
import { css, TOP, BOTTOM, avBg, initials } from '../css'
import { BackButton, Loader } from '../primitives'
import { useToast } from '../toast'

type SettableRole = 'student' | 'advisor' | 'admin'
const ROLE_C: Record<string, { bg: string; c: string }> = {
  student: { bg: '#e8faf2', c: '#10b981' },
  advisor: { bg: '#eef0ff', c: '#6366f1' },
  admin: { bg: '#ffe4e6', c: '#e11d48' },
  superadmin: { bg: '#ffe4e6', c: '#e11d48' },
}

export default function StaffRoles() {
  const { actualUser, currentUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [people, setPeople] = useState<User[] | null>(null)

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    apiSchoolUsers().then(users => {
      if (!cancelled) setPeople(users.filter(u => u.role !== 'superadmin' && u.id !== currentUser.id))
    }).catch(() => { if (!cancelled) setPeople([]) })
    return () => { cancelled = true }
  }, [actualUser.id, currentUser.id])

  async function setRole(userId: string, role: SettableRole) {
    setPeople(prev => prev ? prev.map(p => p.id === userId ? { ...p, role: role as Role } : p) : prev)
    toast(`Role set to ${role}`)
    try {
      await fetch(`/api/school/users/${userId}/role`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    } catch { /* optimistic */ }
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 14px 0;flex:none;'), paddingTop: TOP(14) }}><BackButton onClick={() => router.push('/admin')} /></div>
      <div style={css('padding:10px 20px 12px;flex:none;')}>
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:25px;letter-spacing:-.03em;color:#0f1729;")}>Staff &amp; roles</div>
        <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>Promote members to advisor or admin</div>
      </div>
      {people === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:2px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {people.length === 0 ? (
            <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:30px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;")}>No other members yet</div>
              <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Share an invite code to add people.</div>
            </div>
          ) : people.map(p => {
            const rc = ROLE_C[p.role] ?? ROLE_C.student
            const seg = (r: SettableRole) => ({ bg: p.role === r ? '#0f1729' : 'transparent', c: p.role === r ? '#fff' : '#8a8f9a' })
            return (
              <div key={p.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px;margin-bottom:10px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('display:flex;align-items:center;gap:12px;')}>
                  <span style={css(`width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);flex:none;background:${avBg(p.name)};`)}>{initials(p.name)}</span>
                  <div style={css('flex:1;min-width:0;')}><div style={css('font-size:14px;font-weight:700;color:#1f2734;')}>{p.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{p.email}</div></div>
                  <span style={css(`font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:4px 9px;border-radius:8px;flex:none;background:${rc.bg};color:${rc.c};`)}>{p.role}</span>
                </div>
                <div style={css('display:flex;gap:5px;background:#f4f5f7;border-radius:11px;padding:4px;margin-top:12px;')}>
                  {(['student', 'advisor', 'admin'] as const).map(r => {
                    const s = seg(r)
                    return <button key={r} onClick={() => setRole(p.id, r)} style={css(`flex:1;height:32px;border-radius:8px;border:none;cursor:pointer;font-size:12.5px;font-weight:700;font-family:inherit;text-transform:capitalize;background:${s.bg};color:${s.c};transition:all .15s;`)}>{r}</button>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
