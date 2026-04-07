'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { User, Role } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  currentUser: User
  devRole: Role | null
  setDevRole: (role: Role | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOADING_USER: User = { id: '', name: 'Loading...', email: '', role: 'student' }

// Routes that don't require a school enrollment check
const NO_SCHOOL_REQUIRED = ['/sign-in', '/sign-up', '/onboard', '/join', '/setup', '/superadmin']

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser()
  const [baseUser, setBaseUser] = useState<User>(LOADING_USER)
  const [devRole, setDevRole] = useState<Role | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  useEffect(() => {
    if (!isLoaded || !clerkUser) return

    const id = clerkUser.id
    const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''

    // Ensure user exists in Supabase; preserve existing role
    // Role from Clerk publicMetadata takes precedence (used for superadmin)
    const clerkRole = clerkUser.publicMetadata?.role as Role | undefined

    supabase.from('users').upsert(
      { id, name, email, role: clerkRole ?? 'student' },
      { onConflict: 'id', ignoreDuplicates: true }
    ).then(() => {
      supabase.from('users').select('role, school_id').eq('id', id).maybeSingle().then(({ data }) => {
        const role = clerkRole ?? (data?.role as Role) ?? 'student'
        const schoolId = data?.school_id ?? undefined
        setBaseUser({ id, name, email, role, schoolId })

        // If user has no school and isn't superadmin, send them to /join
        const currentPath = pathnameRef.current
        const skipCheck = NO_SCHOOL_REQUIRED.some(p => currentPath.startsWith(p))
        if (!skipCheck && role !== 'superadmin' && !schoolId) {
          router.push('/join')
        }
      })
    })
  }, [isLoaded, clerkUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // devRole overrides the role for UI testing only.
  // currentUser.id is always the real Clerk user — data always saves to your account.
  const currentUser: User = devRole
    ? { ...baseUser, role: devRole }
    : baseUser

  return (
    <AuthContext.Provider value={{ currentUser, devRole, setDevRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useMockAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}
