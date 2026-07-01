'use client'

// Chat thread (route: /chat/[clubId], phone). Live via useChatStore; sender
// names + club meta via /api/school/* (service-role; reliable on the phone shell).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { apiSchoolClubs, apiSchoolUsers } from '@/lib/school-api'
import type { ChatChannel, Club, User } from '@/types'
import { css, TOP, BOTTOM, clubGlyph, tintFor } from '../css'
import { useToast } from '../toast'

export default function ChatThread() {
  const params = useParams<{ clubId: string }>()
  const clubId = params?.clubId
  const { currentUser } = useMockAuth()
  const { messages, sendMessage, sendError, clearSendError, markClubRead } = useChatStore()
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [club, setClub] = useState<Club | null>(null)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Channel state
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [channelSaving, setChannelSaving] = useState(false)

  // Channel member management (advisor/admin only)
  const [managingMembers, setManagingMembers] = useState(false)
  const [channelMemberIds, setChannelMemberIds] = useState<Set<string>>(new Set())
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null)

  // Reactions: messageId -> list of { userId, emoji }
  const [reactions, setReactions] = useState<Record<string, { userId: string; emoji: string }[]>>({})
  const [emojiPickerFor, setEmojiPickerFor] = useState<{ id: string; senderId: string; mine: boolean } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)
  const lastTap = useRef<{ id: string; t: number }>({ id: '', t: 0 })

  const selectedChannel = channels.find((c) => c.id === selectedChannelId) ?? channels[0] ?? null

  const canManageChannels =
    currentUser.role === 'admin' ||
    club?.advisorId === currentUser.id

  const clubMessages = useMemo(
    () => messages
      .filter(m =>
        m.clubId === clubId &&
        m.channelId === (selectedChannel?.id ?? null) &&
        !blocked.has(m.senderId)
      )
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [messages, clubId, blocked, selectedChannel]
  )

  // Load who this user has blocked so their messages stay hidden.
  useEffect(() => {
    let cancelled = false
    fetch('/api/school/chat/block', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.blockedIds) setBlocked(new Set(d.blockedIds as string[])) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function reportMessage(id: string) {
    setEmojiPickerFor(null)
    try {
      const res = await fetch('/api/school/chat/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: id }) })
      toast(res.ok ? 'Report sent — an admin will review it' : 'Could not submit the report')
    } catch { toast('Could not submit the report') }
  }

  async function blockUser(senderId: string, name: string) {
    setEmojiPickerFor(null)
    try {
      const res = await fetch('/api/school/chat/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: senderId }) })
      if (res.ok) { setBlocked(prev => new Set(prev).add(senderId)); toast(`Blocked ${name.split(' ')[0]}`) }
      else toast('Could not block this user')
    } catch { toast('Could not block this user') }
  }

  useEffect(() => {
    if (!clubId) return
    let cancelled = false
    apiSchoolClubs().then(r => { if (!cancelled) setClub(r.clubs.find(c => c.id === clubId) ?? null) }).catch(() => {})
    return () => { cancelled = true }
  }, [clubId])

  // Fetch channels for this club
  useEffect(() => {
    if (!clubId) return
    let cancelled = false
    fetch(`/api/school/chat/channels?clubId=${clubId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((d: { channels?: ChatChannel[] } | null) => {
        if (cancelled || !d?.channels) return
        setChannels(d.channels)
        if (d.channels.length > 0) setSelectedChannelId(prev => prev ?? d.channels![0].id)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clubId])

  // Resolve sender names for whoever appears in the thread.
  useEffect(() => {
    let cancelled = false
    apiSchoolUsers().then(users => {
      if (cancelled) return
      const map: Record<string, User> = {}
      for (const u of users) map[u.id] = u
      setUsersById(map)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [clubId])

  // Keep pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [clubMessages.length])

  // Mark this club's chat read on open and as new messages arrive while viewing.
  const latestSentAt = clubMessages.length ? clubMessages[clubMessages.length - 1].sentAt : ''
  useEffect(() => {
    if (clubId) markClubRead(clubId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, latestSentAt])

  // Load reactions on open, when messages change, and on a light poll (there's
  // no realtime channel for reactions). Clean up the long-press timer on unmount.
  useEffect(() => {
    void fetchReactions()
    const interval = setInterval(() => { void fetchReactions() }, 20_000)
    return () => {
      clearInterval(interval)
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, latestSentAt])

  useEffect(() => {
    if (sendError) { toast(sendError); clearSendError() }
  }, [sendError, toast, clearSendError])

  function send() {
    const text = draft.trim()
    if (!text || !clubId) return
    setDraft('')
    void sendMessage(clubId, text, selectedChannel?.id ?? null)
  }

  const REACTION_EMOJI = ['❤️', '👍', '😂', '😮', '😢', '🙏']

  async function fetchReactions() {
    if (!clubId) return
    try {
      const res = await fetch(`/api/school/chat/reactions?clubId=${clubId}`, { cache: 'no-store' })
      if (!res.ok) return
      const d = await res.json() as { reactions?: { messageId: string; userId: string; emoji: string }[] }
      const map: Record<string, { userId: string; emoji: string }[]> = {}
      for (const r of d.reactions ?? []) {
        (map[r.messageId] ??= []).push({ userId: r.userId, emoji: r.emoji })
      }
      setReactions(map)
    } catch {
      // non-fatal
    }
  }

  function iReacted(messageId: string, emoji: string) {
    return (reactions[messageId] ?? []).some(r => r.userId === currentUser.id && r.emoji === emoji)
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const has = iReacted(messageId, emoji)
    setReactions(prev => {
      const list = prev[messageId] ? [...prev[messageId]] : []
      const next = has
        ? list.filter(r => !(r.userId === currentUser.id && r.emoji === emoji))
        : [...list, { userId: currentUser.id, emoji }]
      return { ...prev, [messageId]: next }
    })
    try {
      await fetch('/api/school/chat/reactions', {
        method: has ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, emoji }),
      })
    } catch {
      void fetchReactions()
    }
  }

  // Gesture handling: long-press opens the emoji picker, double-tap toggles a
  // heart, and (for others' messages) the picker also carries Report/Block.
  function onMsgPointerDown(m: { id: string; senderId: string }, mine: boolean) {
    longPressed.current = false
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      setEmojiPickerFor({ id: m.id, senderId: m.senderId, mine })
    }, 450)
  }

  function onMsgPointerUp(m: { id: string }) {
    if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null }
    if (longPressed.current) return
    const now = Date.now()
    if (lastTap.current.id === m.id && now - lastTap.current.t < 300) {
      lastTap.current = { id: '', t: 0 }
      void toggleReaction(m.id, '❤️')
    } else {
      lastTap.current = { id: m.id, t: now }
    }
  }

  async function openMemberManager() {
    if (!selectedChannel) return
    setManagingMembers(true)
    try {
      const res = await fetch(`/api/school/chat/channels/members?channelId=${selectedChannel.id}`, { cache: 'no-store' })
      const data = await res.json() as { memberIds?: string[] }
      setChannelMemberIds(new Set(data.memberIds ?? []))
    } catch {
      toast('Could not load members')
    }
  }

  async function toggleMember(userId: string) {
    if (!selectedChannel || savingMemberId) return
    const isMember = channelMemberIds.has(userId)
    setSavingMemberId(userId)
    try {
      const res = await fetch('/api/school/chat/channels/members', {
        method: isMember ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: selectedChannel.id, userId }),
      })
      if (res.ok) {
        setChannelMemberIds(prev => {
          const next = new Set(prev)
          if (isMember) next.delete(userId); else next.add(userId)
          return next
        })
      } else {
        toast('Could not update member')
      }
    } catch {
      toast('Could not update member')
    } finally {
      setSavingMemberId(null)
    }
  }

  async function handleCreateChannel() {
    const name = newChannelName.trim()
    if (!name || channelSaving || !clubId) return
    setChannelSaving(true)
    try {
      const res = await fetch('/api/school/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, name }),
      })
      const data = await res.json() as { channel?: ChatChannel }
      if (res.ok && data.channel) {
        setChannels(prev => [...prev, data.channel!])
        setSelectedChannelId(data.channel!.id)
        setNewChannelName('')
        setCreatingChannel(false)
      } else {
        toast('Could not create channel')
      }
    } catch {
      toast('Could not create channel')
    } finally {
      setChannelSaving(false)
    }
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      {/* Header */}
      <div style={{ ...css('padding:0 14px 11px;background:rgba(242,242,247,.86);backdrop-filter:blur(14px);border-bottom:1px solid #e6e6ec;display:flex;align-items:center;gap:11px;flex:none;z-index:5;'), paddingTop: TOP(12) }}>
        <button onClick={() => router.push('/chat')} style={css('border:none;background:none;cursor:pointer;padding:2px;')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
        <span style={css(`width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;background:${club ? tintFor(club.id) : '#eef0ff'};`)}>{club ? clubGlyph(club) : '💬'}</span>
        <div style={css('flex:1;min-width:0;')}>
          <div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>{club?.name ?? 'Club chat'}</div>
          <div style={css('font-size:11px;color:#9aa0ac;font-weight:500;')}>{club ? `${club.memberIds.length} members` : ''}</div>
        </div>
      </div>

      {/* Channel tabs */}
      {channels.length > 0 && (
        <div style={css('background:#fff;border-bottom:1px solid #e6e6ec;flex:none;overflow-x:auto;display:flex;align-items:center;padding:0 10px;gap:2px;-webkit-overflow-scrolling:touch;scrollbar-width:none;')}>
          {channels.map((ch) => {
            const active = ch.id === selectedChannel?.id
            return (
              <button
                key={ch.id}
                onClick={() => setSelectedChannelId(ch.id)}
                style={css(`border:none;background:none;cursor:pointer;padding:9px 10px;font-size:13px;font-weight:${active ? '700' : '500'};color:${active ? '#6366f1' : '#9aa0ac'};white-space:nowrap;border-bottom:2px solid ${active ? '#6366f1' : 'transparent'};transition:color .15s,border-color .15s;display:flex;align-items:center;gap:4px;`)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                {ch.name}
              </button>
            )
          })}
          {canManageChannels && selectedChannel && !creatingChannel && (
            <button
              onClick={() => void openMemberManager()}
              title="Manage who's in this channel"
              style={css('border:none;background:none;cursor:pointer;padding:9px 8px;color:#9aa0ac;display:flex;align-items:center;flex:none;')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </button>
          )}
          {canManageChannels && !creatingChannel && (
            <button
              onClick={() => setCreatingChannel(true)}
              style={css('border:none;background:none;cursor:pointer;padding:9px 10px;color:#9aa0ac;display:flex;align-items:center;gap:3px;font-size:12px;font-weight:600;white-space:nowrap;')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          )}
          {canManageChannels && creatingChannel && (
            <div style={css('display:flex;align-items:center;gap:5px;padding:4px 8px;background:#f4f4f8;border-radius:8px;margin:4px 4px;')}>
              <input
                autoFocus
                value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleCreateChannel() }
                  if (e.key === 'Escape') { setCreatingChannel(false); setNewChannelName('') }
                }}
                placeholder="channel-name"
                maxLength={50}
                style={css('border:none;background:none;outline:none;font-size:13px;font-weight:600;color:#1f2734;width:100px;')}
              />
              <button
                onClick={() => void handleCreateChannel()}
                disabled={channelSaving || !newChannelName.trim()}
                style={css('border:none;background:#6366f1;color:#fff;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:700;cursor:pointer;opacity:' + (channelSaving || !newChannelName.trim() ? '0.5' : '1') + ';')}
              >
                Add
              </button>
              <button
                onClick={() => { setCreatingChannel(false); setNewChannelName('') }}
                style={css('border:none;background:none;cursor:pointer;color:#9aa0ac;font-size:16px;line-height:1;padding:0 2px;')}
              >×</button>
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="m-noscroll" style={css('flex:1;overflow-y:auto;padding:16px 16px 12px;display:flex;flex-direction:column;gap:11px;')}>
        {clubMessages.length === 0 && (
          <div style={css('margin:auto;font-size:13px;color:#9aa0ac;font-weight:500;text-align:center;')}>
            {selectedChannel ? `No messages in #${selectedChannel.name} yet` : 'No messages yet — say hello 👋'}
          </div>
        )}
        {clubMessages.map((m, i, arr) => {
          const mine = m.senderId === currentUser.id
          const prev = arr[i - 1]
          const showName = !mine && (!prev || prev.senderId !== m.senderId)
          // Group this message's reactions by emoji, with counts.
          const grouped = new Map<string, number>()
          for (const r of reactions[m.id] ?? []) grouped.set(r.emoji, (grouped.get(r.emoji) ?? 0) + 1)
          return (
            <div key={m.id} style={css(`display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};`)}>
              <div style={css(`max-width:80%;display:flex;flex-direction:column;align-items:${mine ? 'flex-end' : 'flex-start'};`)}>
                {showName && <span style={css('font-size:10.5px;font-weight:700;color:#9aa0ac;margin:0 0 3px 4px;')}>{usersById[m.senderId]?.name ?? '…'}</span>}
                <div
                  onPointerDown={() => onMsgPointerDown(m, mine)}
                  onPointerUp={() => onMsgPointerUp(m)}
                  onPointerLeave={() => { if (longPressTimer.current) { window.clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                  onContextMenu={e => e.preventDefault()}
                  style={css(`padding:9px 13px;border-radius:${mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px'};font-size:13.5px;line-height:1.4;font-weight:500;background:${mine ? '#6366f1' : '#ffffff'};color:${mine ? '#ffffff' : '#1f2734'};box-shadow:0 1px 1px rgba(16,24,40,.05);cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;`)}
                >{m.content}</div>
                {grouped.size > 0 && (
                  <div style={css(`display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;justify-content:${mine ? 'flex-end' : 'flex-start'};`)}>
                    {Array.from(grouped.entries()).map(([emoji, count]) => {
                      const reacted = iReacted(m.id, emoji)
                      return (
                        <button
                          key={emoji}
                          onClick={() => void toggleReaction(m.id, emoji)}
                          style={css(`display:flex;align-items:center;gap:3px;border:1px solid ${reacted ? '#c7d2fe' : '#e6e6ec'};background:${reacted ? '#eef0ff' : '#fff'};border-radius:11px;padding:2px 7px;cursor:pointer;font-size:12px;font-weight:600;color:#4b5162;line-height:1;`)}
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
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
          placeholder={selectedChannel ? `#${selectedChannel.name}…` : 'Message…'}
          style={css('flex:1;background:#fff;border:1px solid #e2e3e8;border-radius:21px;padding:10px 15px;font-size:13.5px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;min-width:0;')}
        />
        <button onClick={send} style={css('width:40px;height:40px;border-radius:50%;border:none;background:#6366f1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg></button>
      </div>

      {/* Channel member management (advisor/admin). Pick who's in this channel. */}
      {managingMembers && selectedChannel && (
        <div style={css('position:fixed;inset:0;z-index:140;')}>
          <div onClick={() => setManagingMembers(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
          <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 16px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);max-height:76%;display:flex;flex-direction:column;'), paddingBottom: BOTTOM(20) }}>
            <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 10px;flex:none;')} />
            <div style={css('font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;text-align:center;margin-bottom:2px;flex:none;')}>Members of #{selectedChannel.name}</div>
            <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;text-align:center;margin-bottom:12px;flex:none;')}>Only people you add here can see this channel.</div>
            <div className="m-noscroll" style={css('background:#fff;border-radius:16px;overflow-y:auto;flex:1;margin-bottom:10px;')}>
              {(() => {
                const candidateIds = Array.from(new Set([
                  ...(club?.advisorId ? [club.advisorId] : []),
                  ...(club?.memberIds ?? []),
                ]))
                if (candidateIds.length === 0) {
                  return <div style={css('padding:20px;text-align:center;font-size:13px;color:#9aa0ac;font-weight:500;')}>No club members yet.</div>
                }
                return candidateIds.map((uid, i) => {
                  const u = usersById[uid]
                  const inChannel = channelMemberIds.has(uid)
                  const isAdvisor = club?.advisorId === uid
                  return (
                    <button
                      key={uid}
                      onClick={() => void toggleMember(uid)}
                      disabled={savingMemberId === uid}
                      style={css(`width:100%;display:flex;align-items:center;gap:11px;padding:12px 14px;border:none;${i > 0 ? 'border-top:1px solid #f4f5f7;' : ''}background:none;cursor:pointer;text-align:left;opacity:${savingMemberId === uid ? '0.5' : '1'};`)}
                    >
                      <span style={css('width:34px;height:34px;border-radius:50%;background:#eef0ff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#6366f1;flex:none;')}>{(u?.name ?? '?').charAt(0).toUpperCase()}</span>
                      <span style={css('flex:1;min-width:0;font-size:14px;font-weight:600;color:#1f2734;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{u?.name ?? uid}{isAdvisor ? ' · advisor' : ''}</span>
                      <span style={css(`width:24px;height:24px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;border:2px solid ${inChannel ? '#6366f1' : '#d4d5db'};background:${inChannel ? '#6366f1' : 'transparent'};`)}>
                        {inChannel && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
            <button onClick={() => setManagingMembers(false)} style={{ ...css('width:100%;background:#fff;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;color:#6366f1;cursor:pointer;flex:none;margin-bottom:6px;') }}>Done</button>
          </div>
        </div>
      )}

      {/* Long-press sheet: react with an emoji, plus Report/Block for others'
          messages (App Store Guideline 1.2). */}
      {emojiPickerFor && (() => {
        const target = emojiPickerFor
        const name = usersById[target.senderId]?.name ?? 'this user'
        return (
          <div style={css('position:fixed;inset:0;z-index:140;')}>
            <div onClick={() => setEmojiPickerFor(null)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
            <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 16px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(20) }}>
              <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 14px;')} />
              <div style={css('background:#fff;border-radius:16px;padding:12px 10px;margin-bottom:10px;display:flex;justify-content:space-between;gap:4px;')}>
                {REACTION_EMOJI.map(emoji => {
                  const reacted = iReacted(target.id, emoji)
                  return (
                    <button
                      key={emoji}
                      onClick={() => { void toggleReaction(target.id, emoji); setEmojiPickerFor(null) }}
                      style={css(`flex:1;border:none;background:${reacted ? '#eef0ff' : 'transparent'};border-radius:12px;padding:8px 0;font-size:26px;line-height:1;cursor:pointer;`)}
                    >{emoji}</button>
                  )
                })}
              </div>
              {!target.mine && (
                <div style={css('background:#fff;border-radius:16px;overflow:hidden;margin-bottom:10px;')}>
                  <button onClick={() => reportMessage(target.id)} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:15px 16px;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg><span style={css('font-size:14.5px;font-weight:600;color:#1f2734;')}>Report message</span></button>
                  <button onClick={() => blockUser(target.senderId, name)} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:15px 16px;border:none;background:none;cursor:pointer;text-align:left;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg><span style={css('font-size:14.5px;font-weight:600;color:#ef4444;')}>Block {name.split(' ')[0]}</span></button>
                </div>
              )}
              <button onClick={() => setEmojiPickerFor(null)} style={css('width:100%;background:#fff;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;color:#6366f1;cursor:pointer;')}>Cancel</button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
