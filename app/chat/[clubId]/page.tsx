'use client'

import { useIsMobilePhone } from '@/components/mobile/useIsAdminPhone'
import ChatThread from '@/components/mobile/screens/ChatThread'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchUsersByIds } from '@/lib/school-data'
import { supabase } from '@/lib/supabase'
import { Club, User } from '@/types'
import Avatar from '@/components/Avatar'
import MessageActions from '@/components/chat/MessageActions'
import { ArrowLeft, MessageSquare, Send, Users } from 'lucide-react'

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
  const mobile = useIsMobilePhone()
  if (mobile) return <ChatThread />
  return <ClubChatDesktop params={params} />
}

function ClubChatDesktop({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = use(params)
  const router = useRouter()
  const { currentUser, devRole } = useMockAuth()
  const { messages, sendMessage, sendError, clearSendError } = useChatStore()
  const [draft, setDraft] = useState('')
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const [accessChecked, setAccessChecked] = useState(false)
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const [schoolClubs, setSchoolClubs] = useState<Club[]>([])
  const [club, setClub] = useState<Club | null>(null)
  const [clubLoading, setClubLoading] = useState(true)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
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

  // Load the set of users this person has blocked (Guideline 1.2).
  useEffect(() => {
    if (!currentUser.id) return
    let cancelled = false
    fetch('/api/school/chat/block', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { blockedIds?: string[] }) => {
        if (!cancelled) setBlockedIds(new Set(data.blockedIds ?? []))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [currentUser.id])

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

  const clubMessages = messages.filter(
    (message) => message.clubId === clubId && !blockedIds.has(message.senderId),
  )
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
    void sendMessage(clubId, draft)
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
    <div className="-mx-4 sm:-mx-6 md:-mx-10 -my-6 md:-my-8 -mb-14 md:-mb-8 flex overflow-hidden h-[calc(100dvh-7rem)] md:h-[calc(100vh-3.5rem)]" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:flex w-72 shrink-0 bg-white border-r border-slate-200/60 flex-col overflow-hidden">
        <div className="px-5 py-5 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Your Chats</h3>
          <p className="text-xs text-slate-400 mt-0.5">{accessibleClubs.length} conversation{accessibleClubs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {accessibleClubs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400">No chats yet</p>
            </div>
          ) : (
            accessibleClubs.map((entry) => {
              const isActive = entry.id === clubId
              const lastMessage = messages.filter((message) => message.clubId === entry.id).slice(-1)[0]
              const lastSender = lastMessage ? resolveUser(lastMessage.senderId) : null

              return (
                <Link key={entry.id} href={`/chat/${entry.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-3.5 mx-1.5 rounded-xl cursor-pointer transition-all ${
                    isActive ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 border ${
                      isActive
                        ? 'bg-indigo-100 border-indigo-200'
                        : 'bg-gradient-to-br from-slate-100 to-slate-50 border-slate-200/60'
                    }`}>
                      {entry.iconUrl ?? '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${
                        isActive ? 'text-indigo-700' : 'text-slate-800'
                      }`} style={{ fontFamily: 'var(--font-manrope)' }}>
                        {entry.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {lastMessage
                          ? `${lastSender?.name?.split(' ')[0] ?? '?'}: ${lastMessage.content}`
                          : 'No messages yet'}
                      </p>
                    </div>
                    {isActive && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Chat header */}
        <div className="flex items-center gap-4 px-7 py-4 bg-white border-b border-slate-200/60 shrink-0" style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
          <Link
            href="/chat"
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200/60 flex items-center justify-center text-lg">
            {club.iconUrl ?? '📌'}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-slate-900 leading-tight truncate text-base"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              {club.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Users className="w-3 h-3 text-slate-400" />
              <p className="text-xs text-slate-400 font-medium">
                {club.memberIds.length} members
              </p>
            </div>
          </div>
          {/* Member avatars */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((member) => (
                <div key={member.id} className="ring-2 ring-white rounded-full">
                  <Avatar name={member.name} size="sm" />
                </div>
              ))}
              {members.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                  +{members.length - 4}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          {grouped.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center mx-auto mb-4" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                <MessageSquare className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-500 text-sm font-medium">No messages yet</p>
              <p className="text-slate-400 text-xs mt-1">Start the conversation!</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px bg-slate-200/60" />
                <span className="text-[11px] font-semibold text-slate-400 shrink-0 px-3 py-1 rounded-full bg-white border border-slate-200/60"
                  style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-slate-200/60" />
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
                      className={`group flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      {!isMe && (
                        <div className="w-8 shrink-0">
                          {showAvatar && sender && (
                            <Avatar name={sender.name} size="sm" />
                          )}
                        </div>
                      )}

                      <div className={`max-w-[65%] ${isMe ? 'items-end' : ''}`}>
                        {!isMe && showAvatar && sender && (
                          <p className="text-[11px] text-slate-400 font-medium mb-1 ml-1">
                            {sender.name}
                          </p>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 ${
                            isMe
                              ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-md shadow-lg shadow-indigo-500/20'
                              : 'bg-white text-slate-800 rounded-bl-md border border-slate-200/60'
                          }`}
                          style={!isMe ? { boxShadow: '0 1px 3px rgba(15,23,42,0.03)' } : {}}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                        <p className={`text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                          {formatTime(message.sentAt)}
                        </p>
                      </div>

                      {/* Moderation menu — report / block (Guideline 1.2). */}
                      {!isMe && !message.id.startsWith('msg-temp-') && (
                        <MessageActions
                          messageId={message.id}
                          senderId={message.senderId}
                          senderName={sender?.name ?? 'this user'}
                          onBlocked={(uid) =>
                            setBlockedIds((prev) => new Set(prev).add(uid))
                          }
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-7 py-4 bg-white border-t border-slate-200/60 shrink-0">
          {sendError && (
            <div className="flex items-center justify-between bg-red-50 text-red-600 text-xs rounded-xl px-4 py-2.5 mb-3 border border-red-100">
              <span>{sendError}</span>
              <button onClick={clearSendError} className="ml-3 text-red-400 hover:text-red-600 font-bold">✕</button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200/60 rounded-2xl px-5 h-12 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-300 transition-all">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${club.name}...`}
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 text-slate-800"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 disabled:from-slate-200 disabled:to-slate-300 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none hover:scale-105 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
