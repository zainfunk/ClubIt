'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, usePathname } from 'next/navigation'
import { User, Role } from '@/types'
import { supabase } from '@/lib/supabase'

interface SchoolSession {
  schoolId: string
  schoolName: string
  role: Role
}

interface AuthContextValue {
  currentUser: User
  schoolName: string | null
  schoolPrincipal: string | null
  schoolContactEmail: string | null
  devRole: Role | null
  setDevRole: (role: Role | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOADING_USER: User = { id: '', name: 'Loading...', email: '', role: 'student' }

// Routes that don't require a school enrollment check
const NO_SCHOOL_REQUIRED = ['/sign-in', '/sign-up', '/onboard', '/join', '/setup', '/superadmin']

function lsKey(userId: string) {
  return `clubit_school_${userId}`
}

export function getSchoolSession(userId: string): SchoolSession | null {
  try {
    const raw = localStorage.getItem(lsKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSchoolSession(userId: string, session: SchoolSession) {
  try {
    localStorage.setItem(lsKey(userId), JSON.stringify(session))
  } catch {
    // ignore
  }
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser()
  const [baseUser, setBaseUser] = useState<User>(LOADING_USER)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [schoolPrincipal, setSchoolPrincipal] = useState<string | null>(null)
  const [schoolContactEmail, setSchoolContactEmail] = useState<string | null>(null)
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
    const clerkRole = clerkUser.publicMetadata?.role as Role | undefined

    // Check localStorage first — gives instant result without waiting for Supabase
    const cached = getSchoolSession(id)
    if (cached) {
      const role = clerkRole ?? cached.role
      setBaseUser({ id, name, email, role, schoolId: cached.schoolId })
      setSchoolName(cached.schoolName)
      // No redirect needed — user already has a school
    }

    // Sync with Supabase in the background
    supabase.from('users').upsert(
      { id, name, email, role: clerkRole ?? 'student' },
      { onConflict: 'id', ignoreDuplicates: true }
    ).then(() => {
      supabase.from('users').select('role, school_id').eq('id', id).maybeSingle().then(({ data }) => {
        const role = clerkRole ?? (data?.role as Role) ?? 'student'
        const schoolId = data?.school_id ?? undefined

        setBaseUser({ id, name, email, role, schoolId })

        if (schoolId) {
          supabase.from('schools').select('name, contact_name, contact_email').eq('id', schoolId).maybeSingle().then(({ data: school }) => {
            if (school?.name) {
              setSchoolName(school.name)
              setSchoolPrincipal(school.contact_name ?? null)
              setSchoolContactEmail(school.contact_email ?? null)
              saveSchoolSession(id, { schoolId, schoolName: school.name, role })
            }
          })
        }

        // Only redirect to /join if no cached session AND no Supabase school
        const currentPath = pathnameRef.current
        const skipCheck = NO_SCHOOL_REQUIRED.some(p => currentPath.startsWith(p))
        const hasCached = !!getSchoolSession(id)
        if (!skipCheck && role !== 'superadmin' && !schoolId && !hasCached) {
          router.push('/join')
        }
      })
    })
  }, [isLoaded, clerkUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentUser: User = devRole
    ? { ...baseUser, role: devRole }
    : baseUser

  return (
    <AuthContext.Provider value={{ currentUser, schoolName, schoolPrincipal, schoolContactEmail, devRole, setDevRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useMockAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}
