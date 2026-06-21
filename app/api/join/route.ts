import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { joinLimiter } from '@/lib/rate-limit'
import { randomUUID } from 'node:crypto'
import type { Role } from '@/types'

/**
 * POST /api/join
 *
 * W2.5: invite codes are now bound to identity and time.
 *  - Single-use enforcement on admin/advisor codes (consumed at first
 *    redemption; subsequent attempts return 410 Gone).
 *  - Optional email-domain binding (admin can require codes to be
 *    redeemed from "@school.edu" addresses).
 *  - Existing expiry check stays in place.
 *
 * Service-role usage justified per W2.4-SERVICE-ROLE-INVENTORY.md row 6
 * (writes role + school_id, which the W1.4 trigger blocks for
 * non-service-role callers).
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // W3.2: persistent (Upstash) rate limit, keyed by user. The previous
  // IP-only key let attackers behind shared NAT slip past; user-keyed
  // matches the actual identity.
  const rl = await joinLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const { code } = await request.json()
  if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 })

  // base64url-bodied codes are case-sensitive; trim only.
  const normalised = (code as string).trim()
  const db = createServiceClient()

  // Pull every column we may consult; some are added by 0005 and may
  // not be present on older snapshots, but Supabase tolerates missing
  // columns by returning undefined.
  const cols = 'id, name, status, student_invite_code, admin_invite_code, advisor_invite_code, student_code_expires_at, admin_code_expires_at, advisor_code_expires_at, student_code_email_domain, admin_code_email_domain, advisor_code_email_domain, admin_code_used_at, advisor_code_used_at'

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
  const isStudentCode = school.student_invite_code === normalised

  // Per-code-type expiry, used_at, domain bind.
  const sr = school as Record<string, unknown>
  const matchedExpiresAt = isAdminCode
    ? (sr.admin_code_expires_at as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_expires_at as string | null | undefined)
      : (sr.student_code_expires_at as string | null | undefined)
  const matchedUsedAt = isAdminCode
    ? (sr.admin_code_used_at as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_used_at as string | null | undefined)
      : null
  const matchedDomain = isAdminCode
    ? (sr.admin_code_email_domain as string | null | undefined)
    : isAdvisorCode
      ? (sr.advisor_code_email_domain as string | null | undefined)
      : (sr.student_code_email_domain as string | null | undefined)

  if (matchedExpiresAt && new Date(matchedExpiresAt) < new Date()) {
    return NextResponse.json(
      { error: 'This invite code has expired. Ask your administrator for a new one.' },
      { status: 403 }
    )
  }

  // Single-use for admin/advisor codes: if used_at is set, it's gone.
  if ((isAdminCode || isAdvisorCode) && matchedUsedAt) {
    return NextResponse.json(
      { error: 'This invite code has already been used. Ask your administrator to issue a new one.' },
      { status: 410 }
    )
  }

  // Resolve caller email up front (also needed for domain check below).
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const callerEmail = (clerkUser.primaryEmailAddress?.emailAddress ?? '').toLowerCase()

  // Domain bind: if the school configured a domain for this code class,
  // refuse callers whose primary email doesn't match. Format: either a
  // bare TLD ("edu") or a full "@oakridge.edu" -- both are accepted.
  if (matchedDomain) {
    const required = matchedDomain.toLowerCase().replace(/^@/, '')
    const callerDomain = callerEmail.split('@')[1] ?? ''
    const matches = required.includes('.')
      ? callerDomain === required           // full domain bind
      : callerDomain.endsWith(`.${required}`) || callerDomain === required // tld bind
    if (!matches) {
      return NextResponse.json(
        { error: `This code requires an email at @${required}. Sign in with that address and try again.` },
        { status: 403 }
      )
    }
  }

  const incomingRole: Role = isAdminCode ? 'admin' : isAdvisorCode ? 'advisor' : 'student'
  const isElevated = isAdminCode || isAdvisorCode

  const { data: existingUser } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

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
      { status: 409 }
    )
  }

  const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'

  // ── Admin / advisor codes NEVER grant the role directly. ──────────────────
  // A leaked code must not be enough to become staff. The redeemer is enrolled
  // as a student and a pending request is filed for an existing admin /
  // superadmin to approve (/api/school/staff-requests). The single-use code is
  // NOT consumed here — it's consumed on approval, so a leak that produces only
  // unapproved requests doesn't burn the legitimate invitee's code. We FAIL
  // CLOSED: if the request can't be recorded, no elevation and no role change.
  if (isElevated) {
    if (!existingUser) {
      const { error: enrollErr } = await db
        .from('users')
        .upsert(
          { id: userId, name, email: callerEmail, school_id: school.id, role: 'student' },
          { onConflict: 'id' },
        )
      if (enrollErr) {
        console.error('join: student enroll before staff request failed', enrollErr)
        return NextResponse.json({ error: 'Failed to join the school. Please try again.' }, { status: 500 })
      }
    }

    const { error: reqErr } = await db.from('staff_access_requests').insert({
      id: `req-${randomUUID()}`,
      user_id: userId,
      school_id: school.id,
      requested_role: incomingRole,
      status: 'pending',
    })

    if (reqErr) {
      // 23505 = the one-open-request-per-user unique index: already requested.
      if ((reqErr as { code?: string }).code === '23505') {
        return NextResponse.json({
          schoolId: school.id,
          schoolName: school.name,
          schoolStatus: school.status,
          role: existingUser?.role ?? 'student',
          pendingRole: incomingRole,
          pending: true,
          alreadyPending: true,
        })
      }
      console.error('join: staff request insert failed (failing closed)', reqErr)
      return NextResponse.json(
        { error: 'Could not submit your staff access request. Please contact your school administrator.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      schoolId: school.id,
      schoolName: school.name,
      schoolStatus: school.status,
      role: existingUser?.role ?? 'student',
      pendingRole: incomingRole,
      pending: true,
    })
  }

  // ── Student code: instant, multi-use enrollment (low risk). ───────────────
  const { error } = await db
    .from('users')
    .upsert(
      { id: userId, name, email: callerEmail, school_id: school.id, role: 'student' },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('join upsert error', error)
    return NextResponse.json({ error: 'Failed to save your school role. Please try the code again.' }, { status: 500 })
  }

  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: 'student' },
    })
  } catch (metadataError) {
    console.warn('join metadata sync warning', metadataError)
  }

  return NextResponse.json({
    schoolId: school.id,
    schoolName: school.name,
    schoolStatus: school.status,
    role: 'student',
  })
}
