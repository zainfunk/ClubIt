'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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

  if (schoolStatus === 'suspended' || schoolStatus === 'payment_paused') {
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

  // Redirect effect: only runs once isResolved is true and user is identified.
  // Uses a ref to track whether we've already redirected for this resolution
  // cycle, preventing redirect loops.
  const hasRedirected = useRef(false)

  useEffect(() => {
    // Reset the redirect guard when the user changes
    hasRedirected.current = false
  }, [baseUser.id])

  useEffect(() => {
    if (!isResolved || !baseUser.id || hasRedirected.current) return

    const redirectTarget = getRequiredRoute(
      pathname,
      baseUser.role,
      baseUser.schoolId,
      schoolStatus
    )

    if (redirectTarget && pathname !== redirectTarget) {
      hasRedirected.current = true
      router.replace(redirectTarget)
    }
  }, [isResolved, baseUser.id, pathname, baseUser.role, baseUser.schoolId, schoolStatus, router])

  // Sync school context when user signs in or refreshTick changes.
  // NOTE: pathname is NOT a dependency — we don't want to re-run the entire
  // async sync on every navigation, which causes flash/redirect loops.
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

    // Apply cached session or Clerk role immediately for fast rendering.
    // Only resolve (enable redirects) if we have a cache hit — otherwise
    // wait for the DB sync to avoid redirecting with stale/wrong role.
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
      setIsResolved(true)
    } else if (clerkRole) {
      // Set user state for rendering but do NOT resolve yet —
      // the DB might have a different role (e.g. Clerk says admin,
      // DB says superadmin). Wait for syncSchoolContext to confirm.
      setBaseUser({ id, name, email, role: clerkRole })
    } else {
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
          applySchoolState({ role })
          return
        }

        const { data: school } = await supabase
          .from('schools')
          .select('name, contact_name, contact_email, status, setup_completed_at')
          .eq('id', schoolId)
          .maybeSingle()

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
        if (!cancelled) {
          setIsResolved(true)
        }
      }
    }

    void syncSchoolContext()

    return () => {
      cancelled = true
    }
  }, [isLoaded, clerkUser?.id, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Show children when:
  // - Clerk hasn't loaded yet (unauthenticated pages need to render)
  // - No signed-in user
  // - School context is resolved
  // - Current page doesn't require school context (sign-in, superadmin, etc.)
  const isNoSchoolRoute = NO_SCHOOL_REQUIRED.some((route) => pathname.startsWith(route))
  const showChildren = !isLoaded || !clerkUser || isResolved || isNoSchoolRoute

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
