import Link from 'next/link'
import { Club, User } from '@/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

interface ClubCardProps {
  club: Club
  advisor?: User
  isMember?: boolean
}

export default function ClubCard({ club, advisor, isMember }: ClubCardProps) {
  const spotsLeft = club.capacity - club.memberIds.length
  const isFull = spotsLeft <= 0

  return (
    <Link href={`/clubs/${club.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{club.iconUrl ?? '📌'}</span>
              <div>
                <h3 className="font-semibold text-gray-900 leading-tight">{club.name}</h3>
                {advisor && (
                  <p className="text-xs text-gray-500 mt-0.5">Advisor: {advisor.name}</p>
                )}
              </div>
            </div>
            {isMember && (
              <Badge variant="secondary" className="text-xs shrink-0">
                Joined
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{club.description}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Users className="w-3.5 h-3.5" />
              <span>
                {club.memberIds.length}/{club.capacity}
              </span>
            </div>
            {isFull ? (
              <span className="text-xs text-red-500 font-medium">Full</span>
            ) : (
              <span className="text-xs text-green-600 font-medium">{spotsLeft} spots left</span>
            )}
          </div>
          {club.tags && club.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {club.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
