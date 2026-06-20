'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import StaffRoles from '@/components/mobile/screens/StaffRoles'

// Admin-only mobile route. Desktop admins manage roles from /admin.
export default function StaffPage() {
  const adminPhone = useIsAdminPhone()
  const router = useRouter()
  useEffect(() => { if (!adminPhone) router.replace('/admin') }, [adminPhone, router])
  return adminPhone ? <StaffRoles /> : null
}
