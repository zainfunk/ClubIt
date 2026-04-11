'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { ChatMessage } from '@/types'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, content: string) => Promise<void>
  sendError: string | null
  clearSendError: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

function mapRow(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    clubId: (r.club_id ?? r.clubId) as string,
    senderId: (r.sender_id ?? r.senderId) as string,
    content: r.content as string,
    sentAt: (r.sent_at ?? r.sentAt) as string,
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useMockAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sendError, setSendError] = useState<string | null>(null)

  function mergeMessages(incoming: ChatMessage[]) {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]))
      for (const m of incoming) {
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
        setMessages(data.messages.map(mapRow).sort((a, b) => a.sentAt.localeCompare(b.sentAt)))
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

  // Realtime subscription (bonus) + polling fallback (reliable)
  useEffect(() => {
    if (!currentUser.schoolId) return

    const channel = supabase
      .channel(`chat_messages_${currentUser.schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          mergeMessages([mapRow(payload.new as Record<string, unknown>)])
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      void fetchMessages()
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.schoolId])

  async function sendMessage(clubId: string, content: string) {
    const trimmed = content.trim()
    if (!trimmed) return

    setSendError(null)

    // Optimistic update with a temp ID
    const tempId = `msg-temp-${Date.now()}`
    const optimistic: ChatMessage = {
      id: tempId,
      clubId,
      senderId: currentUser.id,
      content: trimmed,
      sentAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/school/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, content: trimmed }),
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
