'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { onRealtimeEvent } from '@/lib/realtime'
import { ChatMessage } from '@/types'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, content: string, channelId?: string | null) => Promise<void>
  sendError: string | null
  clearSendError: () => void
  /** Unread message count per club (messages from others newer than last read). */
  unreadByClub: Record<string, number>
  /** Total unread across all clubs — drives the bottom-nav Chat tab badge. */
  totalUnread: number
  /** Mark a club's chat read up to now (called when opening a thread). */
  markClubRead: (clubId: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

function mapRow(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    clubId: (r.club_id ?? r.clubId) as string,
    channelId: ((r.channel_id ?? r.channelId) as string | null) ?? null,
    senderId: (r.sender_id ?? r.senderId) as string,
    content: r.content as string,
    sentAt: (r.sent_at ?? r.sentAt) as string,
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useMockAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)

  // Channels this user is allowed to read, kept in a ref so the realtime
  // listener always sees the latest set without re-subscribing. Realtime
  // broadcasts every insert school-wide, so we drop inserts for channels the
  // user isn't a member of — otherwise a private channel's messages would leak
  // into the chat-list preview.
  const accessibleChannelIds = useRef<Set<string>>(new Set())

  // Last-read timestamp per club (ISO string), loaded from the server.
  const [reads, setReads] = useState<Record<string, string>>({})

  /**
   * Merge incoming messages into state, deduplicating by id.
   * Also collapses optimistic temp messages: if an incoming message's
   * content + senderId match a temp (`msg-temp-*`) entry, the temp is replaced.
   */
  function mergeMessages(incoming: ChatMessage[]) {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))

      for (const m of incoming) {
        // Deduplicate: if this real message matches an optimistic temp, remove the temp.
        // We match on senderId + content + clubId AND require the temp to be recent
        // (within 60s) to avoid false matches when the same content is sent twice.
        if (!m.id.startsWith('msg-temp-')) {
          for (const [key, existing] of map) {
            if (
              key.startsWith('msg-temp-') &&
              existing.senderId === m.senderId &&
              existing.content === m.content &&
              existing.clubId === m.clubId &&
              existing.channelId === m.channelId &&
              Math.abs(new Date(existing.sentAt).getTime() - new Date(m.sentAt).getTime()) < 60_000
            ) {
              map.delete(key)
              break
            }
          }
        }
        map.set(m.id, m)
      }

      return Array.from(map.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    })
  }

  async function fetchMessages() {
    try {
      const res = await fetch('/api/school/chat', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as { messages?: Record<string, unknown>[]; accessibleChannelIds?: string[] }
      if (data.accessibleChannelIds) {
        accessibleChannelIds.current = new Set(data.accessibleChannelIds)
      }
      if (data.messages) {
        // Use mergeMessages instead of setMessages so we don't overwrite
        // realtime events that arrived while the fetch was in flight.
        mergeMessages(data.messages.map(mapRow))
      }
    } catch (err) {
      console.error('chat fetch error', err)
    }
  }

  async function fetchReads() {
    try {
      const res = await fetch('/api/school/chat/reads', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as { reads?: Record<string, string> }
      if (data.reads) setReads(data.reads)
    } catch {
      // non-fatal — unread badges just won't reflect prior reads
    }
  }

  // Initial load
  useEffect(() => {
    if (!currentUser.schoolId) {
      setMessages([])
      setReads({})
      return
    }
    void fetchMessages()
    void fetchReads()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.schoolId])

  // Listen for realtime chat events from the centralised subscription manager
  useEffect(() => {
    const unsub = onRealtimeEvent((event) => {
      if (event.type === 'chat_message_insert') {
        const msg = mapRow(event.payload)
        // Only accept inserts for channels this user can read. Own messages are
        // always accepted so the sender's optimistic update reconciles even if
        // the accessible-channel set hasn't refreshed yet.
        if (msg.senderId === currentUser.id || (msg.channelId && accessibleChannelIds.current.has(msg.channelId))) {
          mergeMessages([msg])
        }
      }
    })
    return unsub
  }, [currentUser.id])

  // Polling fallback — keeps things in sync if realtime channel drops
  useEffect(() => {
    if (!currentUser.schoolId) return
    const interval = setInterval(() => { void fetchMessages() }, 30_000)
    return () => { clearInterval(interval) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.schoolId])

  async function sendMessage(clubId: string, content: string, channelId?: string | null) {
    const trimmed = content.trim()
    if (!trimmed) return

    setSendError(null)

    // Optimistic update with a temp ID
    const tempId = `msg-temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      clubId,
      channelId: channelId ?? null,
      senderId: currentUser.id,
      content: trimmed,
      sentAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/school/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, channelId: channelId ?? null, content: trimmed }),
      })

      const data = await res.json() as { error?: string; message?: Record<string, unknown> }

      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setSendError(data.error ?? 'Failed to send message')
        return
      }

      // Swap temp message for the persisted one from the server
      if (data.message) {
        const persisted = mapRow(data.message)
        setMessages((prev) => prev.map((m) => (m.id === tempId ? persisted : m)))
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setSendError('Network error — message not sent')
    }
  }

  // Unread = messages from someone else, newer than this club's last-read mark.
  const unreadByClub = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of messages) {
      if (m.senderId === currentUser.id) continue
      if (m.id.startsWith('msg-temp-')) continue
      const lastRead = reads[m.clubId]
      if (!lastRead || m.sentAt > lastRead) {
        counts[m.clubId] = (counts[m.clubId] ?? 0) + 1
      }
    }
    return counts
  }, [messages, reads, currentUser.id])

  const totalUnread = useMemo(
    () => Object.values(unreadByClub).reduce((sum, n) => sum + n, 0),
    [unreadByClub],
  )

  function markClubRead(clubId: string) {
    // Optimistically advance the read mark so badges clear immediately.
    setReads((prev) => ({ ...prev, [clubId]: new Date().toISOString() }))
    void fetch('/api/school/chat/reads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId }),
    }).catch(() => {})
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage, sendError, clearSendError: () => setSendError(null), unreadByClub, totalUnread, markClubRead }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatStore() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatStore must be used inside ChatProvider')
  return ctx
}
