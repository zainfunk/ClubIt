'use client'

import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS } from '@/lib/mock-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GraduationCap } from 'lucide-react'

const ROLE_STYLES: Record<string, string> = {
  admin: 'border-red-200 bg-red-50 hover:bg-red-100',
  advisor: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
  student: 'border-green-200 bg-green-50 hover:bg-green-100',
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  advisor: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
}

export default function LoginPage() {
  const { setCurrentUser, currentUser } = useMockAuth()
  const router = useRouter()

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="text-center mb-8">
        <GraduationCap className="w-8 h-8 text-blue-600 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-gray-900">Select an account</h1>
        <p className="text-sm text-gray-500 mt-1">
          Development mode — switch between roles to test the app
        </p>
      </div>
      <div className="space-y-3">
        {USERS.map((user) => (
          <button
            key={user.id}
            onClick={() => {
              setCurrentUser(user)
              router.push('/')
            }}
            className={`w-full text-left border rounded-xl p-4 transition-colors cursor-pointer ${ROLE_STYLES[user.role]} ${currentUser.id === user.id ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[user.role]}`}>
                {user.role}
              </span>
            </div>
          </button>
        ))}
      </div>
      {currentUser && (
        <p className="text-center text-xs text-gray-400 mt-6">
          Currently signed in as <strong>{currentUser.name}</strong>
        </p>
      )}
    </div>
  )
}
