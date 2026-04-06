'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ChatMessage } from '@/types'
import { supabase } from '@/lib/supabase'

interface ChatContextValue {
  messages: ChatMessage[]
  sendMessage: (clubId: string, senderId: string, content: string) => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    supabase.from('chat_messages').select('*').order('sent_at').then(({ data }) => {
      if (data) setMessages(data.map(mapMessage))
    })

    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => [...prev, mapMessage(payload.new as Record<string, unknown>)])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function sendMessage(clubId: string, senderId: string, content: string) {
    await supabase.from('chat_messages').insert({
      id: `msg-${Date.now()}`,
      club_id: clubId,
      sender_id: senderId,
      content: content.trim(),
      sent_at: new Date().toISOString(),
    })
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

function mapMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    clubId: r.club_id as string,
    senderId: r.sender_id as string,
    content: r.content as string,
    sentAt: r.sent_at as string,
  }
}
