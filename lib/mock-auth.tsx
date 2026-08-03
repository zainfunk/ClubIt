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
  openRegistration?: boolean
  registrationSlug?: string | null
}

interface AuthContextValue {
  actualUser: User
  currentUser: User
  schoolName: string | null
  schoolStatus: SchoolStatus | null
  schoolPrincipal: string | null
  schoolContactEmail: string | null
  schoolSetupCompletedAt: string | null
  // Open-registration (e.g. UConn): the school lets students self-serve. The
  // slug drives the "Register a club" link (/join/<slug>?register=1).
  openRegistration: boolean
  registrationSlug: string | null
  devRole: Role | null
  setDevRole: (role: Role | null) => void
  refreshSchoolContext: () => void
  leaveSchool: () => Promise<{ ok: boolean; status?: string; message?: string }>
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
  const [openRegistration, setOpenRegistration] = useState<boolean>(false)
  const [registrationSlug, setRegistrationSlug] = useState<string | null>(null)
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
      openRegistration?: boolean
      registrationSlug?: string | null
      persist?: boolean
    }) {
      if (cancelled) return

      setBaseUser({ id, name, email, role: args.role, schoolId: args.schoolId })
      setSchoolName(args.schoolName ?? null)
      setSchoolStatus(args.schoolStatus ?? null)
      setSchoolPrincipal(args.contactName ?? null)
      setSchoolContactEmail(args.contactEmail ?? null)
      setSchoolSetupCompletedAt(args.setupCompletedAt ?? null)
      setOpenRegistration(args.openRegistration ?? false)
      setRegistrationSlug(args.registrationSlug ?? null)

      if (args.schoolId && args.schoolName && args.persist !== false) {
        saveSchoolSession(id, {
          schoolId: args.schoolId,
          schoolName: args.schoolName,
          role: args.role,
          schoolStatus: args.schoolStatus ?? undefined,
          setupCompletedAt: args.setupCompletedAt ?? null,
          openRegistration: args.openRegistration ?? false,
          registrationSlug: args.registrationSlug ?? null,
        })
      } else if (!args.schoolId) {
        clearSchoolSession(id)
      }
    }

    // Apply cached session or Clerk role immediately for fast rendering.
    //
    // We do NOT resolve (enable redirects / show school-scoped pages) from the
    // cache alone. The cache is only a paint hint — it can be stale (the user
    // left/was removed from the school, or the school was reseeded server-side),
    // and trusting it as authoritative is what let a no-longer-enrolled user see
    // the dashboard until /api/user/sync corrected it. Resolution now happens in
    // exactly one place: the finally block of syncSchoolContext, against the
    // authoritative DB state. Applying the cached values here still gives an
    // instant, fully-populated paint the moment children are allowed to show.
    const cached = getSchoolSession(id)
    if (cached) {
      applySchoolState({
        role: clerkRole ?? cached.role,
        schoolId: cached.schoolId,
        schoolName: cached.schoolName,
        schoolStatus: cached.schoolStatus ?? null,
        setupCompletedAt: cached.setupCompletedAt ?? null,
        openRegistration: cached.openRegistration ?? false,
        registrationSlug: cached.registrationSlug ?? null,
        persist: false,
      })
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
        const res = await fetch('/api/user/sync')
        if (!res.ok) {
          // API call failed — fall back to whatever we have
          return
        }

        const data = await res.json() as {
          role: string
          schoolId?: string | null
          schoolName?: string | null
          schoolStatus?: string | null
          contactName?: string | null
          contactEmail?: string | null
          setupCompletedAt?: string | null
          openRegistration?: boolean
          registrationSlug?: string | null
        }

        const role = (data.role as Role) ?? clerkRole ?? 'student'
        const schoolId = data.schoolId ?? undefined

        if (!schoolId) {
          applySchoolState({ role })
          return
        }

        applySchoolState({
          role,
          schoolId,
          schoolName: data.schoolName ?? null,
          schoolStatus: (data.schoolStatus as SchoolStatus | undefined) ?? null,
          contactName: data.contactName ?? null,
          contactEmail: data.contactEmail ?? null,
          setupCompletedAt: data.setupCompletedAt ?? null,
          openRegistration: data.openRegistration ?? false,
          registrationSlug: data.registrationSlug ?? null,
        })
      } finally {
        if (!cancelled) {
          // Re-allow ONE redirect evaluation against the authoritative DB state.
          // The first pass may have redirected using the stale localStorage cache
          // (e.g. a just-approved school still cached as 'pending', or a freshly
          // promoted role), and the guard would otherwise pin the user there until
          // a hard reload. Resetting here lets the redirect effect correct course
          // once fresh data lands; it's loop-safe because the data only changes
          // this once per sync.
          hasRedirected.current = false
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

  async function leaveSchool(): Promise<{ ok: boolean; status?: string; message?: string }> {
    try {
      const res = await fetch('/api/school/leave', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as { status?: string; message?: string; error?: string }
      if (!res.ok) {
        // Blocked (e.g. sole admin) — keep the user where they are and surface why.
        return { ok: false, status: data.status, message: data.message ?? data.error ?? 'Could not leave the school.' }
      }
    } catch {
      return { ok: false, message: 'Something went wrong. Please try again.' }
    }

    // Success: clear cached context and route back to onboarding.
    if (clerkUser?.id) {
      clearSchoolSession(clerkUser.id)
    }
    setBaseUser((u) => ({ ...u, schoolId: undefined, role: 'student' }))
    setSchoolName(null)
    setSchoolStatus(null)
    setSchoolPrincipal(null)
    setSchoolContactEmail(null)
    setSchoolSetupCompletedAt(null)
    setOpenRegistration(false)
    setRegistrationSlug(null)
    hasRedirected.current = false
    router.replace('/join')
    return { ok: true }
  }

  const currentUser: User = devRole
    ? { ...baseUser, role: devRole }
    : baseUser

  // A redirect is "pending" when school context is resolved but the current
  // route isn't where this user belongs (e.g. a no-school user sitting on
  // /dashboard who is about to be bounced to /join). We compute it here with
  // the SAME inputs the redirect effect uses so the render gate and the
  // navigation never disagree.
  const pendingRedirect =
    isResolved && baseUser.id
      ? getRequiredRoute(pathname, baseUser.role, baseUser.schoolId, schoolStatus)
      : null

  // Show children when:
  // - Clerk hasn't loaded yet (unauthenticated pages need to render)
  // - No signed-in user
  // - Current page doesn't require school context (sign-in, superadmin, etc.)
  // - School context is resolved AND no redirect to a different route is
  //   pending. That last clause is the fix: without it, a no-school user's
  //   /dashboard paints for a frame (looking "as if they're in a school")
  //   before the post-paint redirect effect bounces them to /join. Holding
  //   children back until the redirect lands removes that flash and the
  //   "click anything → code page" bounce.
  const isNoSchoolRoute = NO_SCHOOL_REQUIRED.some((route) => pathname.startsWith(route))
  const showChildren =
    !isLoaded ||
    !clerkUser ||
    isNoSchoolRoute ||
    (isResolved && (!pendingRedirect || pendingRedirect === pathname))

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
        openRegistration,
        registrationSlug,
        devRole,
        setDevRole,
        refreshSchoolContext: () => setRefreshTick((tick) => tick + 1),
        leaveSchool,
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
