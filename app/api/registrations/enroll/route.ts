import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { clubRegistrationLimiter } from '@/lib/rate-limit'
import { resolveOpenSchool, enrollStudent, callerEmails } from '@/lib/open-registration'

/**
 * POST /api/registrations/enroll  { slug }
 *
 * Self-enrol the signed-in caller into an open-registration school as a plain
 * `student` (email-gated), WITHOUT creating a club request. This is what makes
 * "be a regular UConn student" a first-class path: a student who just wants to
 * browse/join clubs enrols here and lands on the normal dashboard; registering
 * a club is a separate, optional action.
 *
 * Idempotent — a caller who is already a member gets { ok: true } and no change.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await clubRegistrationLimiter.check(`enroll:${userId}:ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const body = await request.json().catch(() => null)
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
  if (!slug) {
    return NextResponse.json({ error: 'A registration slug is required' }, { status: 400 })
  }

  const school = await resolveOpenSchool(slug)
  if (!school) {
    return NextResponse.json({ error: 'Open registration is not available here' }, { status: 404 })
  }

  const db = createServiceClient()
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)

  const result = await enrollStudent({
    db,
    userId,
    emails: callerEmails(clerkUser),
    name: clerkUser.fullName ?? clerkUser.username ?? 'New User',
    school,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, slug: school.registration_slug })
}
