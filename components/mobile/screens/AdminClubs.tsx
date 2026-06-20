'use client'

// Clubs list (route: /clubs, phone + admin). Live via fetchSchoolClubs.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchSchoolClubs } from '@/lib/school-data'
import type { Club } from '@/types'
import { css, BOTTOM, clubIcon, tintFor } from '../css'
import { ScreenHeader, SearchBar, Loader, EmptyState } from '../primitives'

export default function AdminClubs() {
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[] | null>(null)

  useEffect(() => {
    const schoolId = actualUser.schoolId
    if (!schoolId) return
    let cancelled = false
    fetchSchoolClubs(schoolId).then(c => { if (!cancelled) setClubs(c) }).catch(() => { if (!cancelled) setClubs([]) })
    return () => { cancelled = true }
  }, [actualUser.schoolId])

  const addBtn = (
    <button onClick={() => router.push('/admin/new-club')} style={css('width:38px;height:38px;border-radius:13px;border:none;background:#0f1729;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  )

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Clubs" right={addBtn}>
        <SearchBar placeholder="Search clubs" />
      </ScreenHeader>
      {clubs === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:8px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {clubs.length === 0 ? <EmptyState title="No clubs yet" sub="Clubs you create will show up here." /> : clubs.map(c => {
            const count = c.memberIds.length
            const full = c.capacity !== null && count >= c.capacity
            const barW = c.capacity ? Math.min(Math.round((count / c.capacity) * 100), 100) : Math.min(Math.round((count / 40) * 100), 100)
            return (
              <button key={c.id} onClick={() => router.push(`/clubs/${c.id}`)} style={css('width:100%;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:13px;margin-bottom:10px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <span style={css(`width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${tintFor(c.id)};`)}>{clubIcon(c.tags, c.name)}</span>
                <div style={css('flex:1;min-width:0;')}>
                  <div style={css('display:flex;align-items:center;gap:7px;')}>
                    <span style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{c.name}</span>
                    {full && <span style={css('font-size:9px;font-weight:800;color:#e11d48;background:#ffe4e6;padding:2px 6px;border-radius:6px;letter-spacing:.03em;flex:none;')}>FULL</span>}
                  </div>
                  <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{(c.tags && c.tags[0]) || 'Club'}</div>
                  <div style={css('display:flex;align-items:center;gap:8px;margin-top:8px;')}>
                    <div style={css('flex:1;height:6px;border-radius:5px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:5px;background:linear-gradient(90deg,#6366f1,#10b981);width:${barW}%;`)} /></div>
                    <span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;flex:none;')}>{count}/{c.capacity ?? '∞'}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
