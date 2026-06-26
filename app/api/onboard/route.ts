import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { sanitizeText } from '@/lib/sanitize'
import { onboardLimiter } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

/**
 * POST /api/onboard
 *
 * W2.3 (finding C-3): self-service school registration NO LONGER auto-grants
 * admin. Instead it creates a school in status='pending' with the
 * requester's user id captured in `requested_admin_user_id`. A superadmin
 * has to explicitly approve via /api/superadmin/schools/[id]/approve before
 * the requester's role flips to 'admin' and invite codes are generated.
 *
 * The requester's `users.school_id` is set to the pending school so the
 * existing routing (in mock-auth.tsx) sends them to /onboard/pending
 * while they wait. Their role stays 'student' (the default seeded by
 * /api/user/sync at first login) until approval.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // W3.2: per-user rate limit so an attacker can't squat 100 schools.
  const rl = await onboardLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many registrations. Try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const body = await request.json()
  const { name, district, contactName, contactEmail } = body

  if (!name || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)

  // Refuse if the user already belongs to (or is requesting admin of) a school.
  const { data: existingUser } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.school_id) {
    return NextResponse.json(
      { error: 'You are already enrolled in a school' },
      { status: 409 },
    )
  }

  // Double-submit guard (#3): the existingUser.school_id check above can't catch
  // a rapid double-tap, because school_id isn't set until the END of this flow —
  // two concurrent submits would both create a school and orphan the first one.
  // If this user already has a pending request, return it instead of minting a
  // duplicate. Migration 0013's partial unique index is the race-proof backstop
  // (caught below as 23505); this is the friendly fast path.
  const { data: existingPending } = await db
    .from('schools')
    .select('id')
    .eq('requested_admin_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingPending) {
    return NextResponse.json({
      schoolId: existingPending.id,
      status: 'pending',
      message: 'Your school registration is already pending review. We’ll email when it’s approved.',
    })
  }

  // Ensure the user row exists before we point school.requested_admin_user_id
  // at it (FK constraint).
  await db.from('users').upsert(
    {
      id: userId,
      name: clerkUser.fullName ?? clerkUser.username ?? contactName.trim(),
      email: clerkUser.primaryEmailAddress?.emailAddress ?? contactEmail.trim().toLowerCase(),
      role: 'student',
      school_id: null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  // Create the school in status='pending'. NO invite codes, NO setup
  // token, NO admin grant. All of those happen on approval.
  const { data: school, error } = await db
    .from('schools')
    .insert({
      name: sanitizeText(name.trim()),
      district: district?.trim() ? sanitizeText(district.trim()) : null,
      contact_name: sanitizeText(contactName.trim()),
      contact_email: contactEmail.trim().toLowerCase(),
      status: 'pending',
      requested_admin_user_id: userId,
    })
    .select()
    .single()

  if (error) {
    // 23505 = the partial unique index (migration 0013): a concurrent submit
    // won the race. Return that pending school rather than erroring.
    if ((error as { code?: string }).code === '23505') {
      const { data: raced } = await db
        .from('schools')
        .select('id')
        .eq('requested_admin_user_id', userId)
        .eq('status', 'pending')
        .maybeSingle()
      if (raced) {
        return NextResponse.json({
          schoolId: raced.id,
          status: 'pending',
          message: 'Your school registration is already pending review. We’ll email when it’s approved.',
        })
      }
    }
    console.error('onboard error', error)
    return NextResponse.json(
      { error: 'Failed to submit registration request. Please try again.' },
      { status: 500 },
    )
  }

  // Tag the requester with this pending school so the routing logic
  // sends them to /onboard/pending. Role stays 'student'; it flips to
  // 'admin' only when the superadmin approves.
  const { error: userError } = await db
    .from('users')
    .update({ school_id: school.id })
    .eq('id', userId)

  if (userError) {
    console.error('onboard user update error', userError)
    return NextResponse.json(
      { error: 'Submission saved but we could not link your account to it. Please contact support.' },
      { status: 500 },
    )
  }

  await audit({
    action: 'school.requested',
    targetTable: 'schools',
    targetId: school.id,
    after: { name: school.name, contactEmail: school.contact_email, status: 'pending' },
    actorUserId: userId,
    request,
  })

  return NextResponse.json({
    schoolId: school.id,
    status: 'pending',
    message: 'Your school registration is pending review. We’ll email when it’s approved.',
  })
}
