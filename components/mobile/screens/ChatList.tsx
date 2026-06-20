'use client'

// Chat list (route: /chat, phone + admin). Threads = school clubs with their
// last message, from useChatStore + fetchSchoolClubs.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchSchoolClubs } from '@/lib/school-data'
import type { Club } from '@/types'
import { css, BOTTOM, clubIcon, tintFor } from '../css'
import { ScreenHeader, SearchBar, Loader, EmptyState } from '../primitives'
import { relTime } from '../format'

export default function ChatList() {
  const { actualUser } = useMockAuth()
  const router = useRouter()
  const { messages } = useChatStore()
  const [clubs, setClubs] = useState<Club[] | null>(null)

  useEffect(() => {
    const schoolId = actualUser.schoolId
    if (!schoolId) return
    let cancelled = false
    fetchSchoolClubs(schoolId).then(c => { if (!cancelled) setClubs(c) }).catch(() => { if (!cancelled) setClubs([]) })
    return () => { cancelled = true }
  }, [actualUser.schoolId])

  const threads = useMemo(() => {
    if (!clubs) return []
    const lastByClub: Record<string, { content: string; sentAt: string }> = {}
    for (const m of messages) {
      const cur = lastByClub[m.clubId]
      if (!cur || m.sentAt > cur.sentAt) lastByClub[m.clubId] = { content: m.content, sentAt: m.sentAt }
    }
    return clubs
      .map(c => ({ club: c, last: lastByClub[c.id] }))
      .sort((a, b) => {
        if (a.last && b.last) return b.last.sentAt.localeCompare(a.last.sentAt)
        if (a.last) return -1
        if (b.last) return 1
        return a.club.name.localeCompare(b.club.name)
      })
  }, [clubs, messages])

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Chat">
        <SearchBar placeholder="Search messages" />
      </ScreenHeader>
      {clubs === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 14px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {threads.length === 0 ? <EmptyState title="No conversations" sub="Club chats appear here once clubs exist." /> : threads.map(({ club, last }) => (
            <button key={club.id} onClick={() => router.push(`/chat/${club.id}`)} style={css('width:100%;display:flex;align-items:center;gap:13px;padding:12px 8px;border:none;background:none;cursor:pointer;text-align:left;border-bottom:1px solid #ebebf0;')}>
              <span style={css(`width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${tintFor(club.id)};`)}>{clubIcon(club.tags, club.name)}</span>
              <div style={css('flex:1;min-width:0;')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;')}><span style={css("font-family:var(--font-manrope);font-weight:700;font-size:14.5px;color:#0f1729;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{club.name}</span><span style={css('font-size:11px;color:#9aa0ac;font-weight:500;flex:none;')}>{last ? relTime(last.sentAt) : ''}</span></div>
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px;')}><span style={css('font-size:12.5px;color:#8a8f9a;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{last ? last.content : 'No messages yet'}</span></div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
