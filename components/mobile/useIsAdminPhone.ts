'use client'

// Phone-class + role gating for the new mobile experience. Roles listed in
// MOBILE_ROLES get the mobile design; others keep the existing responsive UI
// until their version ships.

import { useIsPhone } from './DeviceProvider'
import { useMockAuth } from '@/lib/mock-auth'
import type { Role } from '@/types'

// Roles migrated to the new mobile design. Keep in sync with AppShell.
export const MOBILE_ROLES: Role[] = ['admin', 'superadmin', 'student']

/** Phone-class client whose role has been migrated to the mobile design. */
export function useIsMobilePhone(): boolean {
  const isPhone = useIsPhone()
  const { currentUser } = useMockAuth()
  return isPhone && MOBILE_ROLES.includes(currentUser.role)
}

/** Phone-class client who is specifically an admin/superadmin. */
export function useIsAdminPhone(): boolean {
  const isPhone = useIsPhone()
  const { currentUser } = useMockAuth()
  return isPhone && (currentUser.role === 'admin' || currentUser.role === 'superadmin')
}
