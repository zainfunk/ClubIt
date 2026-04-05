'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { Role } from '@/types'
import { useEffect } from 'react'

interface RoleGuardProps {
  allowed: Role[]
  children: ReactNode
}

export default function RoleGuard({ allowed, children }: RoleGuardProps) {
  const { currentUser } = useMockAuth()
  const router = useRouter()

  useEffect(() => {
    if (!allowed.includes(currentUser.role)) {
      router.replace('/')
    }
  }, [currentUser.role, allowed, router])

  if (!allowed.includes(currentUser.role)) return null

  return <>{children}</>
}
