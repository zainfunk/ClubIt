'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, MEMBERSHIPS, getUserById, getEventsByClub } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, MapPin, Globe, Calendar, Crown } from 'lucide-react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ClubDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()

  const [clubs, setClubs] = useState(CLUBS)
  const [memberships, setMemberships] = useState(MEMBERSHIPS)

  const club = clubs.find((c) => c.id === id)
  if (!club) notFound()

  const advisor = getUserById(club.advisorId)
  const members = club.memberIds.map((mid) => getUserById(mid)).filter(Boolean)
  const events = getEventsByClub(club.id)
  const isMember = club.memberIds.includes(currentUser.id)
  const isFull = club.memberIds.length >= club.capacity

  function handleJoin() {
    setClubs((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, memberIds: [...c.memberIds, currentUser.id] } : c
      )
    )
    setMemberships((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        clubId: id,
        userId: currentUser.id,
        joinedAt: new Date().toISOString().split('T')[0],
      },
    ])
  }

  function handleLeave() {
    setClubs((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, memberIds: c.memberIds.filter((mid) => mid !== currentUser.id) }
          : c
      )
    )
    setMemberships((prev) =>
      prev.filter((m) => !(m.clubId === id && m.userId === currentUser.id))
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{club.iconUrl ?? '📌'}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
              {advisor && (
                <p className="text-sm text-gray-500 mt-1">Advisor: {advisor.name}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {club.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {club.socialLinks.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-700 transition-colors"
                title={link.platform}
              >
                <Globe className="w-4 h-4" />
              </a>
            ))}
            {currentUser.role === 'student' && (
              isMember ? (
                <Button variant="outline" size="sm" onClick={handleLeave}>
                  Leave Club
                </Button>
              ) : (
                <Button size="sm" onClick={handleJoin} disabled={isFull}>
                  {isFull ? 'Club Full' : 'Join Club'}
                </Button>
              )
            )}
          </div>
        </div>
        <p className="text-gray-600 mt-4 leading-relaxed">{club.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Members */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
                <span className="text-gray-400 font-normal">
                  {club.memberIds.length}/{club.capacity}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="space-y-2">
                {members.map((member) => {
                  if (!member) return null
                  const positions = club.leadershipPositions.filter(
                    (lp) => lp.userId === member.id
                  )
                  return (
                    <div key={member.id} className="flex items-center justify-between py-1">
                      <span className="text-sm text-gray-700">{member.name}</span>
                      <div className="flex gap-1">
                        {positions.map((pos) => (
                          <Badge
                            key={pos.id}
                            variant="outline"
                            className="text-xs flex items-center gap-1"
                          >
                            <Crown className="w-3 h-3 text-yellow-500" />
                            {pos.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-gray-400">No upcoming events.</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-gray-900">{event.title}</p>
                        <span className="text-xs text-gray-400 shrink-0">{event.date}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                      {event.location && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Leadership */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                Leadership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {club.leadershipPositions.map((pos) => {
                  const holder = pos.userId ? getUserById(pos.userId) : null
                  return (
                    <div key={pos.id}>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">{pos.title}</p>
                      <p className="text-sm font-medium text-gray-800">
                        {holder ? (
                          holder.name
                        ) : (
                          <span className="text-gray-400 font-normal">Vacant</span>
                        )}
                      </p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Meeting times */}
          {club.meetingTimes.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Meeting Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {club.meetingTimes.map((mt, i) => (
                    <div key={i} className="text-sm">
                      <p className="font-medium text-gray-800">
                        {DAY_NAMES[mt.dayOfWeek]}s — {mt.startTime}–{mt.endTime}
                      </p>
                      {mt.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {mt.location}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
