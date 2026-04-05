'use client'

import { useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS, USERS, MEMBERSHIPS } from '@/lib/mock-data'
import ClubCard from '@/components/clubs/ClubCard'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export default function ClubsPage() {
  const { currentUser } = useMockAuth()
  const [search, setSearch] = useState('')

  const myMembershipClubIds = MEMBERSHIPS
    .filter((m) => m.userId === currentUser.id)
    .map((m) => m.clubId)

  const filtered = CLUBS.filter((club) => {
    const q = search.toLowerCase()
    return (
      club.name.toLowerCase().includes(q) ||
      club.description.toLowerCase().includes(q) ||
      club.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Clubs</h1>
          <p className="text-sm text-gray-500 mt-1">{CLUBS.length} clubs available</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Search clubs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No clubs match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((club) => {
            const advisor = USERS.find((u) => u.id === club.advisorId)
            return (
              <ClubCard
                key={club.id}
                club={club}
                advisor={advisor}
                isMember={myMembershipClubIds.includes(club.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
