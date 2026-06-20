'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import StudentProfile from '@/components/mobile/screens/StudentProfile'

// Admin-only mobile route. Desktop admins view students from /admin.
export default function StudentProfilePage() {
  const adminPhone = useIsAdminPhone()
  const router = useRouter()
  useEffect(() => { if (!adminPhone) router.replace('/admin') }, [adminPhone, router])
  return adminPhone ? <StudentProfile /> : null
}
