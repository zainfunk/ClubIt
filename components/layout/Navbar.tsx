'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS } from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { GraduationCap } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-green-100 text-green-700 border-green-200',
}

export default function Navbar() {
  const { currentUser, setCurrentUser } = useMockAuth()
  const router = useRouter()

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900">
          <GraduationCap className="w-5 h-5 text-blue-600" />
          SchoolSolver
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="/clubs" className="hover:text-gray-900 transition-colors">
            Clubs
          </Link>
          <Link href="/events" className="hover:text-gray-900 transition-colors">
            Events
          </Link>
          <Link href="/elections" className="hover:text-gray-900 transition-colors">
            Elections
          </Link>
          {(currentUser.role === 'student' || currentUser.role === 'advisor') && (
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
              My Clubs
            </Link>
          )}
          {currentUser.role === 'admin' && (
            <Link href="/admin" className="hover:text-gray-900 transition-colors">
              Admin Panel
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLORS[currentUser.role]}`}>
            {currentUser.role}
          </span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const user = USERS.find((u) => u.id === e.target.value)
              if (user) {
                setCurrentUser(user)
                router.push('/')
              }
            }}
            className="text-sm border rounded-md px-2 py-1 bg-white text-gray-700 cursor-pointer"
          >
            {USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  )
}
