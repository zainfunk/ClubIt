'use client'

// True when the current client is phone-class AND the signed-in user is an
// admin/superadmin — i.e. should see the new mobile admin experience. Used by
// route pages to branch between the mobile screen and the desktop view.

import { useIsPhone } from './DeviceProvider'
import { useMockAuth } from '@/lib/mock-auth'

export function useIsAdminPhone(): boolean {
  const isPhone = useIsPhone()
  const { currentUser } = useMockAuth()
  return isPhone && (currentUser.role === 'admin' || currentUser.role === 'superadmin')
}
