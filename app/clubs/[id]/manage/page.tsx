'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobilePhone } from '@/components/mobile/useIsAdminPhone'
import ManageClub from '@/components/mobile/screens/ManageClub'

interface PageProps {
  params: Promise<{ id: string }>
}

// Mobile-only management screen. On desktop the club detail page already has
// inline management, so redirect there.
export default function ManageClubPage({ params }: PageProps) {
  const { id } = use(params)
  const mobile = useIsMobilePhone()
  const router = useRouter()
  useEffect(() => { if (!mobile) router.replace(`/clubs/${id}`) }, [mobile, id, router])
  return mobile ? <ManageClub /> : null
}
