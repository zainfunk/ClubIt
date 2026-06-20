'use client'

// Students roster (route: /students, phone + admin). Live via /api/school/users
// + /api/school/clubs (to label each student's clubs).

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolClubs, apiSchoolUsers } from '@/lib/school-api'
import type { Club, User } from '@/types'
import { css, BOTTOM, avBg, initials } from '../css'
import { ScreenHeader, SearchBar, Loader, EmptyState } from '../primitives'

export default function AdminStudents() {
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[] | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    Promise.all([apiSchoolUsers(), apiSchoolClubs()])
      .then(([u, c]) => { if (!cancelled) { setUsers(u); setClubs(c.clubs) } })
      .catch(() => { if (!cancelled) setUsers([]) })
    return () => { cancelled = true }
  }, [actualUser.id])

  const clubsByUser = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const c of clubs) for (const uid of c.memberIds) (map[uid] ??= []).push(c.name)
    return map
  }, [clubs])

  const students = useMemo(() => (users ?? []).filter(u => u.role === 'student'), [users])
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return students
    return students.filter(u => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s))
  }, [students, q])

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Students" subtitle={users ? `${students.length} student${students.length === 1 ? '' : 's'}` : undefined}>
        <SearchBar placeholder="Search students" value={q} onChange={setQ} />
      </ScreenHeader>
      {users === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:8px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {visible.length === 0 ? <EmptyState title={students.length === 0 ? 'No students yet' : 'No matches'} sub={students.length === 0 ? 'Students who join your school appear here.' : 'Try a different search.'} /> : (
            <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              {visible.map((s, i) => {
                const cl = clubsByUser[s.id] ?? []
                return (
                  <button key={s.id} onClick={() => router.push(`/students/${s.id}`)} style={css(`width:100%;display:flex;align-items:center;gap:12px;padding:11px 0;border:none;background:none;cursor:pointer;text-align:left;${i < visible.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css(`width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:var(--font-manrope);flex:none;background:${avBg(s.name)};`)}>{initials(s.name)}</span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:14px;font-weight:600;color:#1f2734;')}>{s.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{cl.length ? cl.slice(0, 2).join(' · ') : 'No clubs'}</div></div>
                    <span style={css('font-size:11px;font-weight:800;color:#6366f1;background:#eef0ff;padding:3px 8px;border-radius:8px;flex:none;')}>{cl.length} {cl.length === 1 ? 'club' : 'clubs'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
