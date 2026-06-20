'use client'

import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import ChatList from '@/components/mobile/screens/ChatList'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchUsersByIds } from '@/lib/school-data'
import { Club, User } from '@/types'
import Avatar from '@/components/Avatar'
import { MessageSquare, Users, ArrowRight } from 'lucide-react'

export default function ChatPage() {
  const adminPhone = useIsAdminPhone()
  if (adminPhone) return <ChatList />
  return <ChatDesktop />
}

function ChatDesktop() {
  const { currentUser } = useMockAuth()
  const { messages } = useChatStore()
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const [schoolClubs, setSchoolClubs] = useState<Club[]>([])
  const [usersById, setUsersById] = useState<Record<string, User>>({})

  useEffect(() => {
    if (!currentUser.id) return

    fetch('/api/school/clubs', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload: { clubs?: Club[]; myMembershipClubIds?: string[] }) => {
        setSchoolClubs(payload.clubs ?? [])
        setMyClubIds(payload.myMembershipClubIds ?? [])
      })
      .catch(console.error)
  }, [currentUser.id])

  useEffect(() => {
    let cancelled = false
    const userIds = Array.from(new Set([
      ...messages.map((message) => message.senderId),
      ...schoolClubs.map((club) => club.advisorId),
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
  }, [messages, schoolClubs])

  function resolveUser(userId: string): User | undefined {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : undefined)
  }

  const clubs = currentUser.role === 'admin'
    ? schoolClubs
    : schoolClubs.filter((club) => myClubIds.includes(club.id) || club.advisorId === currentUser.id)

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Header */}
      <div className="mb-10 pl-2 sm:pl-0">
        <h2
          className="text-3xl font-extrabold tracking-tight text-slate-900"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Club Chats
        </h2>
        <p className="text-slate-500 mt-1.5 text-sm">
          {currentUser.role === 'admin'
            ? 'You have access to all club chats in your school.'
            : 'Chats for clubs you belong to or advise.'}
        </p>
      </div>

      {clubs.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-slate-200/60" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm font-medium">You haven&apos;t joined any clubs yet.</p>
          <p className="text-slate-400 text-xs mt-1">Join a club to start chatting with members.</p>
          <Link href="/clubs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-4 transition-colors">
            Browse clubs <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clubs.map((club) => {
            const clubMessages = messages.filter((message) => message.clubId === club.id)
            const lastMessage = clubMessages[clubMessages.length - 1]
            const lastSender = lastMessage ? resolveUser(lastMessage.senderId) : null
            const advisor = resolveUser(club.advisorId)
            const msgCount = clubMessages.length

            return (
              <Link key={club.id} href={`/chat/${club.id}`}>
                <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-200/60 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                  style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
                    {club.iconUrl ?? '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-slate-900 truncate text-base" style={{ fontFamily: 'var(--font-manrope)' }}>
                        {club.name}
                      </p>
                      {lastMessage && (
                        <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                          {new Date(lastMessage.sentAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 truncate">
                      {lastMessage
                        ? `${lastSender?.name ?? 'Someone'}: ${lastMessage.content}`
                        : 'No messages yet. Say hello!'}
                    </p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-medium">{club.memberIds.length}</span>
                      </div>
                      {msgCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="font-medium">{msgCount}</span>
                        </div>
                      )}
                      {advisor && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Avatar name={advisor.name} size="sm" />
                          <span className="text-xs text-slate-400 font-medium hidden sm:inline">{advisor.name.split(' ')[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
