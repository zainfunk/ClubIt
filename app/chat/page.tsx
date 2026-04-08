'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { useChatStore } from '@/lib/chat-store'
import { fetchUsersByIds } from '@/lib/school-data'
import { Club, User } from '@/types'
import Avatar from '@/components/Avatar'
import { MessageSquare } from 'lucide-react'

export default function ChatPage() {
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-[2rem] font-bold tracking-tight text-gray-900"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          Club Chats
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          {currentUser.role === 'admin'
            ? 'You have access to all club chats in your school.'
            : 'Chats for clubs you belong to or advise.'}
        </p>
      </div>

      {clubs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">You haven&apos;t joined any clubs yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {clubs.map((club) => {
            const clubMessages = messages.filter((message) => message.clubId === club.id)
            const lastMessage = clubMessages[clubMessages.length - 1]
            const lastSender = lastMessage ? resolveUser(lastMessage.senderId) : null
            const advisor = resolveUser(club.advisorId)

            return (
              <Link key={club.id} href={`/chat/${club.id}`}>
                <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-100 hover:shadow-[0_4px_16px_rgba(0,88,190,0.06)] transition-all cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl shrink-0">
                    {club.iconUrl ?? '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate" style={{ fontFamily: 'var(--font-manrope)' }}>
                        {club.name}
                      </p>
                      {lastMessage && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(lastMessage.sentAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {lastMessage
                        ? `${lastSender?.name ?? 'Someone'}: ${lastMessage.content}`
                        : 'No messages yet. Say hello!'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {advisor && <Avatar name={advisor.name} size="sm" />}
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {club.memberIds.length}
                    </span>
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
