'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import AdminStudents from '@/components/mobile/screens/AdminStudents'

// Admin-only mobile route. Desktop admins manage students from /admin.
export default function StudentsPage() {
  const adminPhone = useIsAdminPhone()
  const router = useRouter()
  useEffect(() => { if (!adminPhone) router.replace('/admin') }, [adminPhone, router])
  return adminPhone ? <AdminStudents /> : null
}
