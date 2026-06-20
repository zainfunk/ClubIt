'use client'

// Chat thread (route: /chat/[clubId], phone). Live via useChatStore; sender
// names + club meta via fetchUsersByIds / fetchClubsByIds.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchClubsByIds, fetchUsersByIds } from '@/lib/school-data'
import type { Club, User } from '@/types'
import { css, TOP, BOTTOM, clubIcon, tintFor } from '../css'
import { useToast } from '../toast'

export default function ChatThread() {
  const params = useParams<{ clubId: string }>()
  const clubId = params?.clubId
  const { currentUser } = useMockAuth()
  const { messages, sendMessage, sendError, clearSendError } = useChatStore()
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [club, setClub] = useState<Club | null>(null)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const scrollRef = useRef<HTMLDivElement>(null)

  const clubMessages = useMemo(
    () => messages.filter(m => m.clubId === clubId).sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [messages, clubId]
  )

  useEffect(() => {
    if (!clubId) return
    let cancelled = false
    fetchClubsByIds([clubId]).then(c => { if (!cancelled) setClub(c[0] ?? null) }).catch(() => {})
    return () => { cancelled = true }
  }, [clubId])

  // Resolve sender names for whoever appears in the thread.
  useEffect(() => {
    const ids = Array.from(new Set(clubMessages.map(m => m.senderId).filter(id => id && !usersById[id])))
    if (ids.length === 0) return
    let cancelled = false
    fetchUsersByIds(ids).then(map => { if (!cancelled) setUsersById(prev => ({ ...prev, ...map })) }).catch(() => {})
    return () => { cancelled = true }
  }, [clubMessages, usersById])

  // Keep pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [clubMessages.length])

  useEffect(() => {
    if (sendError) { toast(sendError); clearSendError() }
  }, [sendError, toast, clearSendError])

  function send() {
    const text = draft.trim()
    if (!text || !clubId) return
    setDraft('')
    void sendMessage(clubId, text)
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 14px 11px;background:rgba(242,242,247,.86);backdrop-filter:blur(14px);border-bottom:1px solid #e6e6ec;display:flex;align-items:center;gap:11px;flex:none;z-index:5;'), paddingTop: TOP(12) }}>
        <button onClick={() => router.push('/chat')} style={css('border:none;background:none;cursor:pointer;padding:2px;')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
        <span style={css(`width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;background:${club ? tintFor(club.id) : '#eef0ff'};`)}>{club ? clubIcon(club.tags, club.name) : '💬'}</span>
        <div style={css('flex:1;min-width:0;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{club?.name ?? 'Club chat'}</div><div style={css('font-size:11px;color:#9aa0ac;font-weight:500;')}>{club ? `${club.memberIds.length} members` : ''}</div></div>
      </div>

      <div ref={scrollRef} className="m-noscroll" style={css('flex:1;overflow-y:auto;padding:16px 16px 12px;display:flex;flex-direction:column;gap:11px;')}>
        {clubMessages.length === 0 && <div style={css('margin:auto;font-size:13px;color:#9aa0ac;font-weight:500;')}>No messages yet — say hello 👋</div>}
        {clubMessages.map((m, i, arr) => {
          const mine = m.senderId === currentUser.id
          const prev = arr[i - 1]
          const showName = !mine && (!prev || prev.senderId !== m.senderId)
          return (
            <div key={m.id} style={css(`display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};`)}>
              <div style={css(`max-width:80%;display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};`)}>
                {showName && <span style={css('font-size:10.5px;font-weight:700;color:#9aa0ac;margin:0 0 3px 4px;')}>{usersById[m.senderId]?.name ?? '…'}</span>}
                <div style={css(`padding:9px 13px;border-radius:${mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px'};font-size:13.5px;line-height:1.4;font-weight:500;background:${mine ? '#6366f1' : '#ffffff'};color:${mine ? '#ffffff' : '#1f2734'};box-shadow:0 1px 1px rgba(16,24,40,.05);`)}>{m.content}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ ...css('padding:10px 14px 10px;background:rgba(242,242,247,.92);backdrop-filter:blur(14px);border-top:1px solid #e6e6ec;display:flex;align-items:center;gap:9px;flex:none;'), paddingBottom: BOTTOM(18) }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Message…"
          style={css('flex:1;background:#fff;border:1px solid #e2e3e8;border-radius:21px;padding:10px 15px;font-size:13.5px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;min-width:0;')}
        />
        <button onClick={send} style={css('width:40px;height:40px;border-radius:50%;border:none;background:#6366f1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg></button>
      </div>
    </div>
  )
}
