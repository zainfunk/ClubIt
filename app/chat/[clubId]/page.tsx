'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { CLUBS, USERS } from '@/lib/mock-data'
import { supabase } from '@/lib/supabase'
import { User, Role } from '@/types'
import Avatar from '@/components/Avatar'
import { ArrowLeft, Send, MessageSquare } from 'lucide-react'

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
  const [clubMemberIds, setClubMemberIds] = useState<string[]>([])
  const [supabaseUsers, setSupabaseUsers] = useState<Record<string, User>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const club = CLUBS.find((c) => c.id === clubId)

  useEffect(() => {
    if (!currentUser.id) return
    supabase.from('memberships').select('club_id').eq('user_id', currentUser.id).then(({ data }) => {
      setMyClubIds((data ?? []).map((r) => r.club_id))
      setAccessChecked(true)
    })
  }, [currentUser.id])

  useEffect(() => {
    // Load all members of this club from Supabase, then fetch user data for unknowns
    supabase.from('memberships').select('user_id').eq('club_id', clubId).then(({ data }) => {
      if (!data?.length) return
      const ids = data.map((r) => r.user_id)
      setClubMemberIds(ids)
      const unknownIds = ids.filter((uid) => !USERS.find((u) => u.id === uid))
      if (unknownIds.length > 0) {
        supabase.from('users').select('id, name, email, role').in('id', unknownIds).then(({ data: userData }) => {
          if (userData?.length) {
            setSupabaseUsers((prev) => {
              const next = { ...prev }
              for (const u of userData) next[u.id] = { id: u.id, name: u.name, email: u.email, role: u.role as Role }
              return next
            })
          }
        })
      }
    })
  }, [clubId])

  const canAccess =
    currentUser.role === 'admin' ||
    devRole === 'advisor' ||
    myClubIds.includes(clubId) ||
    club?.memberIds.includes(currentUser.id) ||
    club?.advisorId === currentUser.id

  useEffect(() => {
    if (accessChecked && (!club || !canAccess)) {
      router.replace('/chat')
    }
  }, [accessChecked, club, canAccess, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!accessChecked || !club || !canAccess) return null

  function resolveUser(userId: string): User | undefined {
    return USERS.find((u) => u.id === userId) ?? supabaseUsers[userId]
  }

  const accessibleClubs = (currentUser.role === 'admin' || devRole === 'advisor')
    ? CLUBS
    : CLUBS.filter((c) => myClubIds.includes(c.id) || c.memberIds.includes(currentUser.id) || c.advisorId === currentUser.id)
  const clubMessages = messages.filter((m) => m.clubId === clubId)
  const advisor = resolveUser(club.advisorId)
  // Merge mock memberIds with Supabase-fetched member IDs for this club
  const allMemberIds = Array.from(new Set([...club.memberIds, ...clubMemberIds]))
  const members = allMemberIds.map((id) => resolveUser(id)).filter(Boolean)

  // Group messages by date
  const grouped: { date: string; msgs: typeof clubMessages }[] = []
  for (const msg of clubMessages) {
    const label = formatDateGroup(msg.sentAt)
    const last = grouped[grouped.length - 1]
    if (last?.date === label) {
      last.msgs.push(msg)
    } else {
      grouped.push({ date: label, msgs: [msg] })
    }
  }

  function handleSend() {
    if (!draft.trim()) return
    sendMessage(clubId, currentUser.id, draft)
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

      {/* ── Chats sidebar ── */}
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
            accessibleClubs.map((c) => {
              const isActive = c.id === clubId
              const lastMsg = messages.filter((m) => m.clubId === c.id).slice(-1)[0]
              const lastSender = lastMsg ? resolveUser(lastMsg.senderId) : null
              return (
                <Link key={c.id} href={`/chat/${c.id}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                      isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {c.iconUrl ?? '📌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate leading-tight ${
                        isActive ? 'text-blue-700' : 'text-gray-800'
                      }`}>
                        {c.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {lastMsg
                          ? `${lastSender?.name?.split(' ')[0] ?? '?'}: ${lastMsg.content}`
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

      {/* ── Messages column ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">
        {/* Header */}
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
              {members.length + 1} members
            </p>
          </div>
        </div>

        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {grouped.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 shrink-0">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="space-y-3">
                {group.msgs.map((msg, i) => {
                  const sender = resolveUser(msg.senderId)
                  const isMe = msg.senderId === currentUser.id
                  const prevMsg = group.msgs[i - 1]
                  const showAvatar = !isMe && msg.senderId !== prevMsg?.senderId

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-end gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar spacer for grouped messages */}
                      {!isMe && (
                        <div className="w-8 shrink-0">
                          {showAvatar && sender && (
                            <Avatar name={sender.name} size="sm" />
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col gap-0.5 max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {showAvatar && !isMe && sender && (
                          <span className="text-[11px] font-semibold text-gray-500 ml-1">
                            {sender.name}
                            {sender.role !== 'student' && (
                              <span className="ml-1 text-[9px] font-bold uppercase tracking-widest text-blue-500">
                                {sender.role}
                              </span>
                            )}
                          </span>
                        )}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMe
                              ? 'bg-[#0058be] text-white rounded-br-sm'
                              : 'bg-white border border-gray-100 text-gray-900 rounded-bl-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-gray-400 mx-1">
                          {formatTime(msg.sentAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
            <input
              ref={inputRef}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-900 placeholder:text-gray-400"
              placeholder={`Message ${club.name}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="w-8 h-8 rounded-lg bg-[#0058be] text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 text-center">
            Press Enter to send
          </p>
        </div>
      </div>

      {/* ── Members sidebar ── */}
      <div className="w-64 shrink-0 bg-white border-l border-gray-100 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Members — {members.length + 1}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {/* Advisor */}
          {advisor && (
            <div className="mb-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 px-5 mb-1">
                Advisor
              </p>
              <div className="flex items-center gap-2.5 px-5 py-2 hover:bg-gray-50 transition-colors">
                <Avatar name={advisor.name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                    {advisor.name}
                  </p>
                  <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wide">
                    Advisor
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-300 px-5 mb-1">
                Students
              </p>
              {members.map((member) => {
                if (!member) return null
                const isYou = member.id === currentUser.id
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-2.5 px-5 py-2 hover:bg-gray-50 transition-colors"
                  >
                    <Avatar name={member.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                        {member.name}
                        {isYou && (
                          <span className="ml-1 text-[10px] font-normal text-gray-400">(you)</span>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
