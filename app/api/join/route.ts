import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { joinLimiter } from '@/lib/rate-limit'
import type { Role } from '@/types'

/**
 * POST /api/join
 *
 * Simplified model (2026-06-26): an invite code grants its role DIRECTLY and
 * INSTANTLY, and every code is INFINITELY reusable.
 *   - Student code  -> role 'student'
 *   - Advisor code  -> role 'advisor'
 *   - Admin code    -> role 'admin'
 * No approval step, no single-use consumption, no expiry, no email-domain bind,
 * and no email-verification requirement — "entering the code gives you the
 * role." (Leaked-code defenses are a deliberate later concern.)
 *
 * Two safety rails remain:
 *   - We never DEMOTE: a user who already holds a higher role keeps it, so
 *     re-entering a lower code (or a stale one) can't strip access.
 *   - No cross-school switching: a user already enrolled in a *different*
 *     school is refused (409).
 *
 * Service-role usage justified per W2.4-SERVICE-ROLE-INVENTORY.md row 6
 * (writes role + school_id, which the W1.4 trigger blocks for non-service-role
 * callers). Writes are scoped by `id` only so they can't silently no-op.
 */

const ROLE_RANK: Record<Role, number> = {
  student: 0,
  advisor: 1,
  admin: 2,
  superadmin: 3,
}

/** Take the higher-privileged of two roles so a code never demotes a user. */
function higherRole(a: Role, b: Role): Role {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // W3.2: persistent (Upstash) rate limit, keyed by user.
  const rl = await joinLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const body = await request.json().catch(() => null)
  const code = body?.code
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
  }

  // base64url-bodied codes are case-sensitive; trim only.
  const normalised = code.trim()
  const db = createServiceClient()

  const cols = 'id, name, status, student_invite_code, admin_invite_code, advisor_invite_code'
  const [{ data: byStudent }, { data: byAdmin }, { data: byAdvisor }] = await Promise.all([
    db.from('schools').select(cols).eq('student_invite_code', normalised).maybeSingle(),
    db.from('schools').select(cols).eq('admin_invite_code', normalised).maybeSingle(),
    db.from('schools').select(cols).eq('advisor_invite_code', normalised).maybeSingle(),
  ])

  const school = byStudent ?? byAdmin ?? byAdvisor
  if (!school) return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
  }

  const isAdminCode = school.admin_invite_code === normalised
  const isAdvisorCode = school.advisor_invite_code === normalised
  const codeRole: Role = isAdminCode ? 'admin' : isAdvisorCode ? 'advisor' : 'student'

  const { data: existingUser } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  // Superadmins manage the platform, not a single school — joining would lose
  // their global role. Refuse instead of silently rebinding them.
  if (existingUser?.role === 'superadmin') {
    return NextResponse.json(
      { error: 'Superadmin accounts cannot join a school. Use a separate account.' },
      { status: 409 },
    )
  }

  // No cross-school switching: belonging to a *different* school is a hard stop.
  if (existingUser?.school_id && existingUser.school_id !== school.id) {
    const { data: currentSchool } = await db
      .from('schools')
      .select('name')
      .eq('id', existingUser.school_id)
      .maybeSingle()

    return NextResponse.json(
      {
        error: `You are already enrolled in ${currentSchool?.name ?? 'another school'}. School switching is not supported yet.`,
      },
      { status: 409 },
    )
  }

  // Never demote: keep the higher of the role they already hold and the code's.
  const currentRole = (existingUser?.role as Role | undefined) ?? 'student'
  const grantedRole = higherRole(currentRole, codeRole)

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const callerEmail = (clerkUser.primaryEmailAddress?.emailAddress ?? '').toLowerCase()
  const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'

  // Authoritative write, scoped by id, asserting a row changed. Existing users
  // get role+school_id only (don't clobber their stored name); new users are
  // inserted with their Clerk identity.
  const { data: saved, error } = existingUser
    ? await db
        .from('users')
        .update({ school_id: school.id, role: grantedRole })
        .eq('id', userId)
        .select('id')
        .maybeSingle()
    : await db
        .from('users')
        .upsert(
          { id: userId, name, email: callerEmail, school_id: school.id, role: grantedRole },
          { onConflict: 'id' },
        )
        .select('id')
        .maybeSingle()

  if (error || !saved) {
    console.error('join: enrol/grant failed', error ?? 'no row updated')
    return NextResponse.json({ error: 'Failed to save your school role. Please try the code again.' }, { status: 500 })
  }

  // Mirror role to Clerk best-effort so routing metadata doesn't lag the DB.
  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: grantedRole },
    })
  } catch (metadataError) {
    console.warn('join metadata sync warning', metadataError)
  }

  return NextResponse.json({
    schoolId: school.id,
    schoolName: school.name,
    schoolStatus: school.status,
    role: grantedRole,
  })
}
