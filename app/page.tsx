'use client'

import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, getUserById, JOIN_REQUESTS } from '@/lib/mock-data'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GraduationCap, BookOpen, Clock, Users } from 'lucide-react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Home() {
  const { currentUser } = useMockAuth()

  // --- Student home ---
  if (currentUser.role === 'student') {
    const myClubs = CLUBS.filter((c) => c.memberIds.includes(currentUser.id))
    const pendingRequests = JOIN_REQUESTS.filter(
      (r) => r.userId === currentUser.id && r.status === 'pending'
    )

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {currentUser.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Here are the clubs you're part of.</p>
        </div>

        {pendingRequests.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-blue-800">
                {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''} awaiting advisor review
              </p>
            </div>
            <div className="space-y-1">
              {pendingRequests.map((req) => {
                const club = CLUBS.find((c) => c.id === req.clubId)
                return (
                  <Link key={req.id} href={`/clubs/${req.clubId}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                    <span>{club?.iconUrl ?? '📌'}</span>
                    {club?.name ?? req.clubId}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {myClubs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border">
            <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium mb-1">You haven't joined any clubs yet.</p>
            <p className="text-sm text-gray-400 mb-5">Browse clubs and request to join ones that interest you.</p>
            <Link href="/clubs" className={cn(buttonVariants())}>Browse Clubs</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myClubs.map((club) => {
              const advisor = getUserById(club.advisorId)
              const myPositions = club.leadershipPositions.filter((p) => p.userId === currentUser.id)
              const nextMeeting = club.meetingTimes[0]

              return (
                <Link key={club.id} href={`/clubs/${club.id}`} className="group block">
                  <div className="bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow h-full">
                    <div className="flex items-start gap-4 mb-4">
                      <span className="text-4xl">{club.iconUrl ?? '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                          {club.name}
                        </h2>
                        {advisor && (
                          <p className="text-xs text-gray-400 mt-0.5">Advisor: {advisor.name}</p>
                        )}
                        {myPositions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {myPositions.map((pos) => (
                              <span key={pos.id} className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                                {pos.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">{club.description}</p>

                    <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {club.memberIds.length} member{club.memberIds.length !== 1 ? 's' : ''}
                      </div>
                      {nextMeeting && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {DAY_NAMES[nextMeeting.dayOfWeek]}s {nextMeeting.startTime}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Link href="/clubs" className={cn(buttonVariants({ variant: 'outline' }))}>
            Browse All Clubs
          </Link>
          <Link href="/events" className={cn(buttonVariants({ variant: 'outline' }))}>
            View Events
          </Link>
        </div>
      </div>
    )
  }

  // --- Advisor home ---
  if (currentUser.role === 'advisor') {
    const myClubs = CLUBS.filter((c) => c.advisorId === currentUser.id)

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Clubs you advise.</p>
        </div>

        {myClubs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500">You are not assigned as advisor to any clubs yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myClubs.map((club) => {
              const pendingCount = JOIN_REQUESTS.filter(
                (r) => r.clubId === club.id && r.status === 'pending'
              ).length

              return (
                <Link key={club.id} href={`/clubs/${club.id}`} className="group block">
                  <div className="bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow h-full">
                    <div className="flex items-start gap-4 mb-3">
                      <span className="text-4xl">{club.iconUrl ?? '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                          {club.name}
                        </h2>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}
                          </span>
                          {pendingCount > 0 && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {pendingCount} pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{club.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // --- Admin home ---
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin" className="bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow text-center group">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-5 h-5 text-red-600" />
          </div>
          <p className="font-semibold text-gray-900 group-hover:text-blue-600">Admin Panel</p>
          <p className="text-xs text-gray-400 mt-1">Manage clubs and elections</p>
        </Link>
        <Link href="/clubs" className="bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow text-center group">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="font-semibold text-gray-900 group-hover:text-blue-600">All Clubs</p>
          <p className="text-xs text-gray-400 mt-1">{CLUBS.length} clubs active</p>
        </Link>
        <Link href="/events" className="bg-white rounded-2xl border p-6 hover:shadow-md transition-shadow text-center group">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-5 h-5 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900 group-hover:text-blue-600">Events</p>
          <p className="text-xs text-gray-400 mt-1">View all club events</p>
        </Link>
      </div>
    </div>
  )
}
