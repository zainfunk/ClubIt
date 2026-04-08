'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchSchoolClubs } from '@/lib/school-data'
import { supabase } from '@/lib/supabase'
import { ChatMessage } from '@/types'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, senderId: string, content: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

function mapMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    clubId: r.club_id as string,
    senderId: r.sender_id as string,
    content: r.content as string,
    sentAt: r.sent_at as string,
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useMockAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [clubIds, setClubIds] = useState<string[]>([])

  const clubKey = useMemo(() => clubIds.slice().sort().join('|'), [clubIds])

  function mergeMessages(incoming: ChatMessage[]) {
    setMessages((prev) => {
      const map = new Map(prev.map((message) => [message.id, message]))
      for (const message of incoming) {
        if (clubIds.length === 0 || clubIds.includes(message.clubId)) {
          map.set(message.id, message)
        }
      }
      return Array.from(map.values()).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    })
  }

  async function fetchMessages(nextClubIds: string[]) {
    if (nextClubIds.length === 0) {
      setMessages([])
      return
    }

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .in('club_id', nextClubIds)
      .order('sent_at')

    if (data) {
      setMessages(data.map(mapMessage))
    }
  }

  useEffect(() => {
    if (!currentUser.schoolId) {
      Promise.resolve().then(() => {
        setClubIds([])
        setMessages([])
      })
      return
    }

    let cancelled = false

    fetchSchoolClubs(currentUser.schoolId).then((clubs) => {
      if (cancelled) return
      const ids = clubs.map((club) => club.id)
      setClubIds(ids)
      void fetchMessages(ids)
    })

    return () => {
      cancelled = true
    }
  }, [currentUser.schoolId])

  useEffect(() => {
    if (!currentUser.schoolId || clubIds.length === 0) return

    const channel = supabase
      .channel(`chat_messages_${currentUser.schoolId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const message = mapMessage(payload.new as Record<string, unknown>)
          if (clubIds.includes(message.clubId)) {
            mergeMessages([message])
          }
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      void fetchMessages(clubIds)
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [clubKey, clubIds, currentUser.schoolId])

  async function sendMessage(clubId: string, senderId: string, content: string) {
    const trimmed = content.trim()
    if (!trimmed) return

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      clubId,
      senderId,
      content: trimmed,
      sentAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, message])

    const { error } = await supabase.from('chat_messages').insert({
      id: message.id,
      club_id: message.clubId,
      sender_id: message.senderId,
      content: message.content,
      sent_at: message.sentAt,
    })

    if (error) {
      console.error('Failed to send message:', error)
      setMessages((prev) => prev.filter((entry) => entry.id !== message.id))
    }
  }

  return (
    <ChatContext.Provider value={{ messages, sendMessage }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatStore() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatStore must be used inside ChatProvider')
  return ctx
}
