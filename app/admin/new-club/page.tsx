'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import CreateClub from '@/components/mobile/screens/CreateClub'

// Admin-only mobile route. Desktop admins create clubs from /admin.
export default function NewClubPage() {
  const adminPhone = useIsAdminPhone()
  const router = useRouter()
  useEffect(() => { if (!adminPhone) router.replace('/admin') }, [adminPhone, router])
  return adminPhone ? <CreateClub /> : null
}
