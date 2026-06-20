'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsPhone } from '@/components/mobile/DeviceProvider'
import { useMockAuth } from '@/lib/mock-auth'
import CreateClub from '@/components/mobile/screens/CreateClub'

// Mobile create-club route for any role that can own a club. Desktop users
// create clubs from /dashboard (advisor) or /admin (admin).
export default function NewClubPage() {
  const isPhone = useIsPhone()
  const { currentUser } = useMockAuth()
  const router = useRouter()
  const canCreate = currentUser.role === 'advisor' || currentUser.role === 'admin' || currentUser.role === 'superadmin'
  const allow = isPhone && canCreate

  useEffect(() => {
    if (!allow) router.replace(canCreate ? '/dashboard' : '/clubs')
  }, [allow, canCreate, router])

  return allow ? <CreateClub /> : null
}
