'use client'

// Events (route: /events, phone + admin). Live via /api/school/events
// (service-role; reliable on the phone shell — see lib/school-api.ts).

import { useEffect, useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolEvents } from '@/lib/school-api'
import { css, BOTTOM, tintFor } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'
import { monthDay } from '../format'
import { useToast } from '../toast'

interface Ev { id: string; clubName: string; tint: string; month: string; day: string; title: string; location: string | null; isPublic: boolean; date: string }

export default function AdminEvents() {
  const { actualUser } = useMockAuth()
  const toast = useToast()
  const [events, setEvents] = useState<Ev[] | null>(null)

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    apiSchoolEvents().then(rows => {
      if (cancelled) return
      const mapped: Ev[] = rows
        .map(r => ({ id: r.id, clubName: r.clubName, tint: tintFor(r.clubId), ...monthDay(r.date), title: r.title, location: r.location, isPublic: r.isPublic, date: r.date }))
      setEvents(mapped)
    }).catch(() => { if (!cancelled) setEvents([]) })
    return () => { cancelled = true }
  }, [actualUser.id])

  const addBtn = (
    <button onClick={() => toast('Create events from a club page')} style={css('width:38px;height:38px;border-radius:13px;border:none;background:#0f1729;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </button>
  )

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Events" right={addBtn} />
      {events === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {events.length === 0 ? <EmptyState title="No events scheduled" sub="Upcoming club events will appear here." /> : events.map(ev => (
            <div key={ev.id} style={css('display:flex;gap:14px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <div style={css(`width:50px;flex:none;text-align:center;background:${ev.tint};border-radius:14px;padding:9px 0;`)}><div style={css('font-size:10px;font-weight:800;color:#6366f1;letter-spacing:.06em;')}>{ev.month}</div><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;color:#0f1729;line-height:1;margin-top:2px;")}>{ev.day}</div></div>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css("font-size:14.5px;font-weight:700;color:#0f1729;font-family:var(--font-manrope);")}>{ev.title}</div>
                <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>{ev.clubName}{ev.location ? ` · ${ev.location}` : ''}</div>
                <div style={css('display:flex;align-items:center;gap:7px;margin-top:9px;')}><span style={css(`font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:${ev.isPublic ? '#e8faf2' : '#fff7e6'};color:${ev.isPublic ? '#10b981' : '#b45309'};`)}>{ev.isPublic ? 'Public' : 'Members'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
