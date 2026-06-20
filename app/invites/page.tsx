'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import AdminInvites from '@/components/mobile/screens/AdminInvites'

// Admin-only mobile route. Desktop admins manage invite codes from /admin.
export default function InvitesPage() {
  const adminPhone = useIsAdminPhone()
  const router = useRouter()
  useEffect(() => { if (!adminPhone) router.replace('/admin') }, [adminPhone, router])
  return adminPhone ? <AdminInvites /> : null
}
