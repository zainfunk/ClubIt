'use client'

// Club detail (route: /clubs/[id], phone + admin). Live via fetchClubDetail.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchClubDetail } from '@/lib/school-data'
import type { User } from '@/types'
import { css, TOP, avBg, clubIcon, gradientFor } from '../css'
import { BackButton, Avatar, Loader } from '../primitives'
import { dayShort, timeRange } from '../format'
import { useToast } from '../toast'

type Detail = Awaited<ReturnType<typeof fetchClubDetail>>

export default function ClubDetail() {
  const params = useParams<{ id: string }>()
  const clubId = params?.id
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()
  const [data, setData] = useState<Detail | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const schoolId = actualUser.schoolId
    if (!schoolId || !clubId) return
    let cancelled = false
    fetchClubDetail(clubId, schoolId)
      .then(d => { if (!cancelled) { setData(d); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [actualUser.schoolId, clubId])

  if (!loaded) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(8), paddingLeft: 16 }}><BackButton onClick={() => router.push('/clubs')} /></div>
        <Loader />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(8), paddingLeft: 16 }}><BackButton onClick={() => router.push('/clubs')} /></div>
        <div style={css('flex:1;display:flex;align-items:center;justify-content:center;font-size:14px;color:#9aa0ac;')}>Club not found.</div>
      </div>
    )
  }

  const { club, usersById, memberships } = data
  const advisor = usersById[club.advisorId]
  const presidentPos = club.leadershipPositions.find(p => /president/i.test(p.title) && p.userId)
  const president = presidentPos?.userId ? usersById[presidentPos.userId] : undefined
  const meeting = club.meetingTimes[0]
  const countLabel = `${club.memberIds.length}/${club.capacity ?? '∞'}`
  const roleByUser: Record<string, string> = {}
  for (const p of club.leadershipPositions) if (p.userId) roleByUser[p.userId] = p.title
  const members: User[] = club.memberIds.map(id => usersById[id]).filter(Boolean) as User[]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={css(`height:170px;position:relative;flex:none;background:${gradientFor(club.id)};`)}>
        <div style={{ position: 'absolute', top: TOP(8), left: 16 }}><BackButton light onClick={() => router.push('/clubs')} /></div>
        <div style={{ position: 'absolute', top: TOP(8), right: 16 }}><button onClick={() => toast('Manage from the admin dashboard')} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Manage</button></div>
        <div style={css('position:absolute;bottom:-30px;left:20px;width:72px;height:72px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 8px 20px rgba(15,23,42,.18);')}>{clubIcon(club.tags, club.name)}</div>
      </div>
      <div className="m-noscroll" style={css('flex:1;overflow-y:auto;padding:42px 20px 40px;')}>
        <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
          <div style={css('min-width:0;')}>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.03em;color:#0f1729;")}>{club.name}</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:600;margin-top:2px;')}>Advised by {advisor?.name ?? 'TBD'}</div>
          </div>
          <span style={css('font-size:11px;font-weight:800;color:#10b981;background:#e8faf2;padding:5px 10px;border-radius:9px;white-space:nowrap;flex:none;')}>{countLabel}</span>
        </div>
        {club.description && <p style={css('font-size:13.5px;line-height:1.55;color:#5b6270;font-weight:500;margin:13px 0 0;')}>{club.description}</p>}

        {club.tags && club.tags.length > 0 && (
          <div style={css('display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;')}>
            {club.tags.map(t => <span key={t} style={css('font-size:11.5px;font-weight:600;color:#5b6270;background:#fff;border:1px solid #eef0f3;padding:5px 11px;border-radius:9px;')}>{t}</span>)}
          </div>
        )}

        {(meeting || president) && (
          <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:5px 16px;margin-top:18px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
            {meeting && (
              <div style={css(`display:flex;align-items:center;gap:11px;padding:13px 0;${president ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{dayShort(meeting.dayOfWeek)}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>{timeRange(meeting.startTime, meeting.endTime)}{meeting.location ? ` · ${meeting.location}` : ''}</div></div>
              </div>
            )}
            {president && (
              <div style={css('display:flex;align-items:center;gap:11px;padding:13px 0;')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5z" /></svg>
                <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{president.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>President</div></div>
              </div>
            )}
          </div>
        )}

        <div style={css('display:flex;align-items:center;justify-content:space-between;margin:20px 4px 11px;')}>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Members</div>
          <span style={css('font-size:12px;font-weight:600;color:#9aa0ac;')}>{countLabel}</span>
        </div>
        <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
          {members.length === 0 ? (
            <div style={css('padding:18px 0;font-size:13px;color:#9aa0ac;text-align:center;')}>No members yet.</div>
          ) : members.map((m, i) => (
            <div key={m.id} style={css(`display:flex;align-items:center;gap:11px;padding:11px 0;${i < members.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
              <Avatar name={m.name} size={36} bg={avBg(m.name)} />
              <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{roleByUser[m.id] || (m.id === club.advisorId ? 'Advisor' : 'Member')}</div></div>
            </div>
          ))}
          {/* members not in leadership but advisor handled above */}
          <MembershipNote count={memberships.length} shown={members.length} />
        </div>
      </div>
    </div>
  )
}

function MembershipNote({ count, shown }: { count: number; shown: number }) {
  if (count <= shown) return null
  return <div style={css('padding:11px 0;font-size:11.5px;color:#b3b9c4;text-align:center;')}>{count - shown} more not shown</div>
}
