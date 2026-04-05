'use client'

import { useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { CLUBS as INITIAL_CLUBS, USERS } from '@/lib/mock-data'
import { Club } from '@/types'
import RoleGuard from '@/components/layout/RoleGuard'
import ClubForm from '@/components/admin/ClubForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Shield } from 'lucide-react'

export default function AdminPage() {
  const { currentUser } = useMockAuth()
  const [clubs, setClubs] = useState<Club[]>(INITIAL_CLUBS)

  const advisors = USERS.filter((u) => u.role === 'advisor')

  function handleCreateClub(
    data: Omit<Club, 'id' | 'memberIds' | 'leadershipPositions' | 'socialLinks' | 'meetingTimes' | 'createdAt'>
  ) {
    const newClub: Club = {
      ...data,
      id: `club-${Date.now()}`,
      memberIds: [],
      leadershipPositions: [],
      socialLinks: [],
      meetingTimes: [],
      createdAt: new Date().toISOString().split('T')[0],
    }
    setClubs((prev) => [...prev, newClub])
  }

  return (
    <RoleGuard allowed={['admin']}>
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage clubs, advisors, and capacity</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <ClubForm advisors={advisors} onSubmit={handleCreateClub} />
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              All Clubs ({clubs.length})
            </h2>
            <div className="space-y-3">
              {clubs.map((club) => {
                const advisor = USERS.find((u) => u.id === club.advisorId)
                const spotsLeft = club.capacity - club.memberIds.length
                return (
                  <Card key={club.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{club.iconUrl ?? '📌'}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{club.name}</p>
                            <p className="text-xs text-gray-500">
                              Advisor: {advisor?.name ?? 'Unassigned'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            {club.memberIds.length}/{club.capacity}
                          </div>
                          {spotsLeft <= 0 ? (
                            <Badge variant="destructive" className="text-xs">Full</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{spotsLeft} spots left</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
