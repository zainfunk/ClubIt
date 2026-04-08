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
  const { actualUser } = useMockAuth()
  const router = useRouter()

  useEffect(() => {
    if (!actualUser.id) return
    if (!allowed.includes(actualUser.role)) {
      router.replace('/')
    }
  }, [actualUser.id, actualUser.role, allowed, router])

  if (!actualUser.id) return null
  if (!allowed.includes(actualUser.role)) return null

  return <>{children}</>
}
