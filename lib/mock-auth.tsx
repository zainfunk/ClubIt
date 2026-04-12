'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSession, useUser } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import { Role, SchoolStatus, User } from '@/types'
import { setSupabaseAccessTokenResolver, supabase } from '@/lib/supabase'

interface SchoolSession {
  schoolId: string
  schoolName: string
  role: Role
  schoolStatus?: SchoolStatus
  setupCompletedAt?: string | null
}

interface AuthContextValue {
  actualUser: User
  currentUser: User
  schoolName: string | null
  schoolStatus: SchoolStatus | null
  schoolPrincipal: string | null
  schoolContactEmail: string | null
  schoolSetupCompletedAt: string | null
  devRole: Role | null
  setDevRole: (role: Role | null) => void
  refreshSchoolContext: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOADING_USER: User = { id: '', name: 'Loading...', email: '', role: 'student' }

const NO_SCHOOL_REQUIRED = [
  '/sign-in',
  '/sign-up',
  '/onboard',
  '/join',
  '/setup',
  '/superadmin',
  '/school',
  '/dev',
  '/landing',
]

const ENTRY_ROUTES = ['/onboard', '/school/suspended']

function getRequiredRoute(pathname: string, role: Role, schoolId?: string, schoolStatus?: SchoolStatus | null) {
  if (role === 'superadmin') {
    // Superadmins don't belong to a school — redirect entry routes to the panel
    if (pathname === '/join' || pathname === '/dashboard' || ENTRY_ROUTES.some((route) => pathname.startsWith(route))) {
      return '/superadmin'
    }
    return null
  }

  if (!schoolId) {
    return NO_SCHOOL_REQUIRED.some((route) => pathname.startsWith(route)) ? null : '/join'
  }

  if (schoolStatus === 'pending') {
    return pathname.startsWith('/onboard') || pathname.startsWith('/dev')
      ? null
      : '/onboard/pending'
  }

  if (schoolStatus === 'suspended') {
    return pathname.startsWith('/school/suspended') || pathname.startsWith('/dev')
      ? null
      : '/school/suspended'
  }

  if (schoolStatus === 'active' && ENTRY_ROUTES.some((route) => pathname.startsWith(route))) {
    return '/dashboard'
  }

  return null
}

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

function clearSchoolSession(userId: string) {
  try {
    localStorage.removeItem(lsKey(userId))
  } catch {
    // ignore
  }
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded } = useUser()
  const { session } = useSession()
  const [baseUser, setBaseUser] = useState<User>(LOADING_USER)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [schoolStatus, setSchoolStatus] = useState<SchoolStatus | null>(null)
  const [schoolPrincipal, setSchoolPrincipal] = useState<string | null>(null)
  const [schoolContactEmail, setSchoolContactEmail] = useState<string | null>(null)
  const [schoolSetupCompletedAt, setSchoolSetupCompletedAt] = useState<string | null>(null)
  const [devRole, setDevRole] = useState<Role | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)
  const [isResolved, setIsResolved] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setSupabaseAccessTokenResolver(
      session
        ? async () => session.getToken()
        : async () => null
    )

    return () => {
      setSupabaseAccessTokenResolver(null)
    }
  }, [session])

  // Redirect effect: only runs once isResolved is true
  useEffect(() => {
    if (!isResolved) return

    const redirectTarget = getRequiredRoute(
      pathname,
      baseUser.role,
      baseUser.schoolId,
      schoolStatus
    )

    if (redirectTarget && pathname !== redirectTarget) {
      router.replace(redirectTarget)
    }
  }, [isResolved, pathname, baseUser.role, baseUser.schoolId, schoolStatus, router])

  useEffect(() => {
    if (!isLoaded || !clerkUser) return

    let cancelled = false

    const id = clerkUser.id
    const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''
    const clerkRole = clerkUser.publicMetadata?.role as Role | undefined

    function applySchoolState(args: {
      role: Role
      schoolId?: string
      schoolName?: string | null
      schoolStatus?: SchoolStatus | null
      contactName?: string | null
      contactEmail?: string | null
      setupCompletedAt?: string | null
      persist?: boolean
    }) {
      if (cancelled) return

      setBaseUser({ id, name, email, role: args.role, schoolId: args.schoolId })
      setSchoolName(args.schoolName ?? null)
      setSchoolStatus(args.schoolStatus ?? null)
      setSchoolPrincipal(args.contactName ?? null)
      setSchoolContactEmail(args.contactEmail ?? null)
      setSchoolSetupCompletedAt(args.setupCompletedAt ?? null)

      if (args.schoolId && args.schoolName && args.persist !== false) {
        saveSchoolSession(id, {
          schoolId: args.schoolId,
          schoolName: args.schoolName,
          role: args.role,
          schoolStatus: args.schoolStatus ?? undefined,
          setupCompletedAt: args.setupCompletedAt ?? null,
        })
      } else if (!args.schoolId) {
        clearSchoolSession(id)
      }
    }

    const cached = getSchoolSession(id)
    if (cached) {
      applySchoolState({
        role: clerkRole ?? cached.role,
        schoolId: cached.schoolId,
        schoolName: cached.schoolName,
        schoolStatus: cached.schoolStatus ?? null,
        setupCompletedAt: cached.setupCompletedAt ?? null,
        persist: false,
      })
      // Cache hit: safe to redirect immediately
      setIsResolved(true)
    } else {
      // No cache: wait for syncSchoolContext before redirecting
      setIsResolved(false)
    }

    async function syncSchoolContext() {
      try {
        await supabase.from('users').upsert(
          { id, name, email, role: clerkRole ?? 'student' },
          { onConflict: 'id', ignoreDuplicates: true }
        )

        const { data: userData } = await supabase
          .from('users')
          .select('role, school_id')
          .eq('id', id)
          .maybeSingle()

        const role = (userData?.role as Role | undefined) ?? clerkRole ?? 'student'
        const schoolId = userData?.school_id ?? undefined

        if (!schoolId) {
          if (cached?.schoolId) {
            applySchoolState({
              role: clerkRole ?? cached.role,
              schoolId: cached.schoolId,
              schoolName: cached.schoolName,
              schoolStatus: cached.schoolStatus ?? null,
              setupCompletedAt: cached.setupCompletedAt ?? null,
              persist: false,
            })
          } else {
            applySchoolState({ role })
          }
          return
        }

        const { data: school } = await supabase
          .from('schools')
          .select('name, contact_name, contact_email, status, setup_completed_at')
          .eq('id', schoolId)
          .maybeSingle()

        if (!school && cached && cached.schoolId === schoolId) {
          applySchoolState({
            role: clerkRole ?? cached.role,
            schoolId: cached.schoolId,
            schoolName: cached.schoolName,
            schoolStatus: cached.schoolStatus ?? null,
            setupCompletedAt: cached.setupCompletedAt ?? null,
            persist: false,
          })
          return
        }

        applySchoolState({
          role,
          schoolId: school ? schoolId : undefined,
          schoolName: school?.name ?? null,
          schoolStatus: (school?.status as SchoolStatus | undefined) ?? null,
          contactName: school?.contact_name ?? null,
          contactEmail: school?.contact_email ?? null,
          setupCompletedAt: school?.setup_completed_at ?? null,
        })
      } finally {
        // Whether sync succeeded or failed, mark as resolved so the
        // redirect effect can evaluate with the best data we have.
        if (!cancelled) {
          setIsResolved(true)
        }
      }
    }

    void syncSchoolContext()

    return () => {
      cancelled = true
    }
  }, [isLoaded, clerkUser?.id, pathname, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for storage changes from other tabs — if another tab signs into
  // a different account and overwrites the school session, re-sync.
  useEffect(() => {
    if (!clerkUser?.id) return

    function onStorage(e: StorageEvent) {
      if (e.key === lsKey(clerkUser!.id)) {
        // Our user's session changed in another tab — re-sync
        setRefreshTick((t) => t + 1)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [clerkUser?.id])

  const currentUser: User = devRole
    ? { ...baseUser, role: devRole }
    : baseUser

  // Don't block rendering when Clerk hasn't loaded yet (unauthenticated pages
  // need to render) — but once we know there's a signed-in user, wait until
  // the school session is resolved before showing children.
  const showChildren = !isLoaded || !clerkUser || isResolved

  return (
    <AuthContext.Provider
      value={{
        actualUser: baseUser,
        currentUser,
        schoolName,
        schoolStatus,
        schoolPrincipal,
        schoolContactEmail,
        schoolSetupCompletedAt,
        devRole,
        setDevRole,
        refreshSchoolContext: () => setRefreshTick((tick) => tick + 1),
      }}
    >
      {showChildren ? children : null}
    </AuthContext.Provider>
  )
}

export function useMockAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useMockAuth must be used inside MockAuthProvider')
  return ctx
}
