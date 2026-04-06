'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EVENTS, CLUBS, getUserById } from '@/lib/mock-data'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Search } from 'lucide-react'

export default function EventsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')

  const today = new Date().toISOString().split('T')[0]

  const publicEvents = EVENTS.filter((e) => e.isPublic)
    .filter((e) => {
      const q = search.toLowerCase()
      const club = CLUBS.find((c) => c.id === e.clubId)
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        club?.name.toLowerCase().includes(q)
      )
    })
    .filter((e) => {
      if (filter === 'upcoming') return e.date >= today
      if (filter === 'past') return e.date < today
      return true
    })
    .sort((a, b) => {
      if (filter === 'past') return b.date.localeCompare(a.date)
      return a.date.localeCompare(b.date)
    })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Calendar className="w-6 h-6 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        </div>
        <p className="text-sm text-gray-500">Public events from all clubs.</p>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search events or clubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border overflow-hidden text-sm">
          {(['upcoming', 'past', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {publicEvents.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border">
          <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No events found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {publicEvents.map((event) => {
            const club = CLUBS.find((c) => c.id === event.clubId)
            const isPast = event.date < today
            const creator = getUserById(event.createdBy)

            return (
              <div
                key={event.id}
                className={`bg-white rounded-xl border p-4 ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Date block */}
                  <div className="shrink-0 w-14 text-center bg-gray-50 border rounded-lg py-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      {new Date(event.date + 'T00:00:00').toLocaleString('en', { month: 'short' })}
                    </p>
                    <p className="text-xl font-bold text-gray-900 leading-none">
                      {new Date(event.date + 'T00:00:00').getDate()}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{event.title}</h3>
                      {isPast && (
                        <Badge variant="outline" className="text-xs shrink-0">Past</Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{event.description}</p>

                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {club && (
                        <Link
                          href={`/clubs/${club.id}`}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                        >
                          <span>{club.iconUrl ?? '📌'}</span>
                          {club.name}
                        </Link>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
