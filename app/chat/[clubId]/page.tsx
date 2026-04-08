'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchUsersByIds } from '@/lib/school-data'
import { supabase } from '@/lib/supabase'
import { Club, User } from '@/types'
import Avatar from '@/components/Avatar'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDateGroup(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function ClubChatPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params)
  const router = useRouter()
  const { currentUser, devRole } = useMockAuth()
  const { messages, sendMessage } = useChatStore()
  const [draft, setDraft] = useState('')
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const [accessChecked, setAccessChecked] = useState(false)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [schoolClubs, setSchoolClubs] = useState<Club[]>([])
  const [club, setClub] = useState<Club | null>(null)
  const [clubLoading, setClubLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser.id) return

    let cancelled = false

    fetch('/api/school/clubs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload: { clubs?: Club[]; myMembershipClubIds?: string[] }) => {
        if (cancelled) return
        const clubs = payload.clubs ?? []
        setSchoolClubs(clubs)
        setMyClubIds(payload.myMembershipClubIds ?? [])
        setClub(clubs.find((entry) => entry.id === clubId) ?? null)
        setClubLoading(false)
        setAccessChecked(true)
      })
      .catch(() => {
        if (!cancelled) setClubLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [clubId, currentUser.id])

  useEffect(() => {
    let cancelled = false
    const userIds = Array.from(new Set([
      ...(club?.memberIds ?? []),
      club?.advisorId ?? '',
      ...messages.filter((message) => message.clubId === clubId).map((message) => message.senderId),
    ].filter(Boolean)))

    if (userIds.length === 0) {
      Promise.resolve().then(() => {
        if (!cancelled) setUsersById({})
      })
      return () => {
        cancelled = true
      }
    }

    fetchUsersByIds(userIds).then((users) => {
      if (!cancelled) setUsersById(users)
    })

    return () => {
      cancelled = true
    }
  }, [club, clubId, messages])

  const canAccess =
    currentUser.role === 'admin' ||
    devRole === 'admin' ||
    devRole === 'advisor' ||
    myClubIds.includes(clubId) ||
    club?.advisorId === currentUser.id

  useEffect(() => {
    if (!clubLoading && accessChecked && (!club || !canAccess)) {
      router.replace('/chat')
    }
  }, [accessChecked, canAccess, club, clubLoading, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (clubLoading || !accessChecked) return null
  if (!club || !canAccess) return null

  function resolveUser(userId: string): User | undefined {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : undefined)
  }

  const accessibleClubs = (currentUser.role === 'admin' || devRole === 'admin' || devRole === 'advisor')
    ? schoolClubs
    : schoolClubs.filter((entry) => myClubIds.includes(entry.id) || entry.advisorId === currentUser.id)

  const clubMessages = messages.filter((message) => message.clubId === clubId)
  const members = club.memberIds
    .map((memberId) => resolveUser(memberId))
    .filter((member): member is User => Boolean(member))

  const grouped: { date: string; msgs: typeof clubMessages }[] = []
  for (const message of clubMessages) {
    const label = formatDateGroup(message.sentAt)
    const last = grouped[grouped.length - 1]
    if (last?.date === label) {
      last.msgs.push(message)
    } else {
      grouped.push({ date: label, msgs: [message] })
    }
  }

  function handleSend() {
    if (!draft.trim()) return
    void sendMessage(clubId, currentUser.id, draft)
    setDraft('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="-mx-8 -my-8 flex overflow-hidden" style={{ height: '100vh' }}>
      <div className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Chats</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {accessibleClubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <MessageSquare className="w-6 h-6 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No chats yet</p>
            </div>
          ) : (
            accessibleClubs.map((entry) => {
              const isActive = entry.id === clubId
              const lastMessage = messages.filter((message) => message.clubId === entry.id).slice(-1)[0]
              const lastSender = lastMessage ? resolveUser(lastMessage.senderId) : null

              return (
                <Link key={entry.id} href={`/chat/${entry.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                      isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {entry.iconUrl ?? '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${
                        isActive ? 'text-blue-700' : 'text-gray-800'
                      }`}>
                        {entry.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {lastMessage
                          ? `${lastSender?.name?.split(' ')[0] ?? '?'}: ${lastMessage.content}`
                          : 'No messages yet'}
                      </p>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">
        <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100 shrink-0">
          <Link
            href="/chat"
            className="text-gray-400 hover:text-gray-700 transition-colors p-1 -ml-1 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-lg">
            {club.iconUrl ?? '📌'}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-gray-900 leading-tight truncate"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {club.name}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
              {club.memberIds.length} members
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {grouped.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-3">
                {group.msgs.map((message, index) => {
                  const sender = resolveUser(message.senderId)
                  const isMe = message.senderId === currentUser.id
                  const previousMessage = group.msgs[index - 1]
                  const showAvatar = !isMe && message.senderId !== previousMessage?.senderId

                  return (
                    <div
                      key={message.id}
                      className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      {!isMe && (
                        <div className="w-8 shrink-0">
                          {showAvatar && sender && (
                            <Avatar name={sender.name} size="sm" />
                          )}
                        </div>
                      )}

                      <div className={`max-w-[70%] ${isMe ? 'items-end' : ''}`}>
                        {!isMe && showAvatar && sender && (
                          <p className="text-[11px] text-gray-400 font-medium mb-1 ml-1">
                            {sender.name}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                            isMe ? 'bg-[#0058be] text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                        <p className={`text-[10px] text-gray-400 mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatTime(message.sentAt)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex -space-x-2">
              {members.slice(0, 3).map((member) => (
                <div key={member.id} className="ring-2 ring-white rounded-full">
                  <Avatar name={member.name} size="sm" />
                </div>
              ))}
            </div>
            <div className="flex-1 flex items-center bg-[#f3f4f5] rounded-2xl px-4 h-12">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${club.name}...`}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="w-8 h-8 rounded-full bg-[#0058be] disabled:bg-gray-300 text-white flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
