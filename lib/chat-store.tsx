'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { onRealtimeEvent } from '@/lib/realtime'
import { ChatMessage } from '@/types'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, content: string, channelId?: string | null) => Promise<void>
  sendError: string | null
  clearSendError: () => void
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
      const data = await res.json() as { messages?: Record<string, unknown>[] }
      if (data.messages) {
        // Use mergeMessages instead of setMessages so we don't overwrite
        // realtime events that arrived while the fetch was in flight.
        mergeMessages(data.messages.map(mapRow))
      }
    } catch (err) {
      console.error('chat fetch error', err)
    }
  }

  // Initial load
  useEffect(() => {
    if (!currentUser.schoolId) {
      setMessages([])
      return
    }
    void fetchMessages()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.schoolId])

  // Listen for realtime chat events from the centralised subscription manager
  useEffect(() => {
    const unsub = onRealtimeEvent((event) => {
      if (event.type === 'chat_message_insert') {
        mergeMessages([mapRow(event.payload)])
      }
    })
    return unsub
  }, [])

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

  return (
    <ChatContext.Provider value={{ messages, sendMessage, sendError, clearSendError: () => setSendError(null) }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatStore() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatStore must be used inside ChatProvider')
  return ctx
}
