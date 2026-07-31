import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { clubRegistrationLimiter } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'
import { ClubRegistrationSchema } from '@/lib/schemas'
import { REGISTRATION_COLUMNS, mapRegistrationRow, type RegistrationRow } from '@/lib/registrations'

/**
 * Self-serve club registration for open-registration schools (UConn).
 *
 *   GET   ?slug=uconn  -> public school info + the caller's own request(s)
 *   POST                -> self-enrol by verified email domain, create a
 *                          PENDING request (one at a time)
 *   PATCH               -> edit the caller's still-pending request
 *
 * The Shelton invite-code flow (/api/join) is untouched. Every mutation is
 * validated server-side and runs through the service-role client; the RLS on
 * club_registration_requests is the enforced backstop (see 0021 migration).
 */

export const dynamic = 'force-dynamic'

interface OpenSchool {
  id: string
  name: string
  status: string
  open_registration: boolean
  allowed_email_domain: string | null
  registration_slug: string | null
}

const SCHOOL_COLUMNS =
  'id, name, status, open_registration, allowed_email_domain, registration_slug'

async function resolveOpenSchool(slug: string): Promise<OpenSchool | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('registration_slug', slug)
    .maybeSingle()

  if (!data || !data.open_registration) return null
  return data as OpenSchool
}

function publicSchool(school: OpenSchool) {
  return {
    name: school.name,
    slug: school.registration_slug,
    allowedEmailDomain: school.allowed_email_domain,
    status: school.status,
  }
}

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug')?.trim()
  if (!slug) {
    return NextResponse.json({ error: 'A registration slug is required' }, { status: 400 })
  }

  const school = await resolveOpenSchool(slug)
  if (!school) {
    return NextResponse.json({ error: 'Open registration is not available here' }, { status: 404 })
  }

  const { userId } = await auth()
  if (!userId) {
    // Unauthenticated visitors still get the school header + a sign-in prompt.
    return NextResponse.json({ school: publicSchool(school), requests: [] })
  }

  const db = createServiceClient()
  const { data: rows } = await db
    .from('club_registration_requests')
    .select(REGISTRATION_COLUMNS)
    .eq('requester_id', userId)
    .eq('school_id', school.id)
    .order('created_at', { ascending: false })

  return NextResponse.json({
    school: publicSchool(school),
    requests: (rows ?? []).map((row) => mapRegistrationRow(row as RegistrationRow)),
  })
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await clubRegistrationLimiter.check(`user:${userId}:ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const parsed = ClubRegistrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const school = await resolveOpenSchool(parsed.data.slug)
  if (!school) {
    return NextResponse.json({ error: 'Open registration is not available here' }, { status: 404 })
  }
  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
  }

  const db = createServiceClient()
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const primary = clerkUser.primaryEmailAddress
  const email = (primary?.emailAddress ?? '').toLowerCase()

  // Server-side email gate: verified primary email ending in the school's
  // allowed domain. This is the only membership check — self-enrolment is
  // gated entirely by proving control of an @uconn.edu inbox via Clerk.
  if (primary?.verification?.status !== 'verified') {
    return NextResponse.json(
      { error: 'Verify your email address with Clerk before registering a club.' },
      { status: 403 },
    )
  }
  if (school.allowed_email_domain && !email.endsWith(`@${school.allowed_email_domain.toLowerCase()}`)) {
    return NextResponse.json(
      { error: `Registration is limited to @${school.allowed_email_domain} email addresses.` },
      { status: 403 },
    )
  }

  const { data: existingUser } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.role === 'superadmin') {
    return NextResponse.json(
      { error: 'Superadmin accounts cannot self-register a club. Use a separate account.' },
      { status: 409 },
    )
  }
  if (existingUser?.school_id && existingUser.school_id !== school.id) {
    return NextResponse.json(
      { error: 'You are already enrolled in another school. School switching is not supported yet.' },
      { status: 409 },
    )
  }

  // Self-enrol into the open-registration school as a student if not already
  // a member. Existing members keep their stored role (never demote).
  if (!existingUser?.school_id) {
    const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
    const { error: enrolError } = existingUser
      ? await db.from('users').update({ school_id: school.id }).eq('id', userId)
      : await db
          .from('users')
          .upsert(
            { id: userId, name, email, school_id: school.id, role: 'student' },
            { onConflict: 'id' },
          )
    if (enrolError) {
      console.error('registrations: enrol failed', enrolError)
      return NextResponse.json({ error: 'Failed to enrol you into the school. Please try again.' }, { status: 500 })
    }
  }

  // Friendly pre-check; the partial unique index is the race-proof backstop.
  const { data: pending } = await db
    .from('club_registration_requests')
    .select('id')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .maybeSingle()
  if (pending) {
    return NextResponse.json(
      { error: 'You already have a pending club registration. Edit it instead of submitting a new one.' },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const { data: inserted, error } = await db
    .from('club_registration_requests')
    .insert({
      id: `clubreg-${randomUUID()}`,
      school_id: school.id,
      requester_id: userId,
      club_name: sanitizeText(parsed.data.clubName),
      description: sanitizeText(parsed.data.description),
      category: parsed.data.category ? sanitizeText(parsed.data.category) : null,
      expected_members: parsed.data.expectedMembers ?? null,
      requester_role: parsed.data.requesterRole,
      contact_info: parsed.data.contactInfo ? sanitizeText(parsed.data.contactInfo) : null,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .select(REGISTRATION_COLUMNS)
    .single()

  if (error || !inserted) {
    // 23505 = unique_violation on the one-pending-per-user index (race).
    if ((error as { code?: string } | null)?.code === '23505') {
      return NextResponse.json(
        { error: 'You already have a pending club registration.' },
        { status: 409 },
      )
    }
    console.error('registrations: insert failed', error)
    return NextResponse.json({ error: 'Failed to submit your registration. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: mapRegistrationRow(inserted as RegistrationRow) })
}

export async function PATCH(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await clubRegistrationLimiter.check(`user:${userId}:ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const parsed = ClubRegistrationSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const db = createServiceClient()

  // Only the caller's own PENDING request is editable. The id-scoped +
  // status-scoped update is the authoritative guard; a decided request is
  // frozen.
  const { data: existing } = await db
    .from('club_registration_requests')
    .select('id, status')
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!existing) {
    return NextResponse.json(
      { error: 'You have no pending registration to edit.' },
      { status: 404 },
    )
  }

  const { data: updated, error } = await db
    .from('club_registration_requests')
    .update({
      club_name: sanitizeText(parsed.data.clubName),
      description: sanitizeText(parsed.data.description),
      category: parsed.data.category ? sanitizeText(parsed.data.category) : null,
      expected_members: parsed.data.expectedMembers ?? null,
      requester_role: parsed.data.requesterRole,
      contact_info: parsed.data.contactInfo ? sanitizeText(parsed.data.contactInfo) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .eq('requester_id', userId)
    .eq('status', 'pending')
    .select(REGISTRATION_COLUMNS)
    .maybeSingle()

  if (error || !updated) {
    console.error('registrations: update failed', error ?? 'no row updated')
    return NextResponse.json({ error: 'Failed to update your registration. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, request: mapRegistrationRow(updated as RegistrationRow) })
}
