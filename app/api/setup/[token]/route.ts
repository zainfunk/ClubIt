import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { setupLimiter } from '@/lib/rate-limit'

// GET: validate token and return school info + invite codes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // W3.2: this is unauthenticated; rate limit by IP.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await setupLimiter.check(`ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const { token } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, name, district, contact_name, contact_email, status, student_invite_code, admin_invite_code, advisor_invite_code, admin_code_used_at, setup_token_expires_at, setup_completed_at')
    .eq('setup_token', token)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid or expired setup link' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not active' }, { status: 403 })
  }

  if (school.setup_token_expires_at && new Date(school.setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 })
  }

  // Once setup is marked complete OR an admin has already redeemed the admin code
  // (i.e. the school is bootstrapped), stop serving the invite codes. A leaked or
  // forwarded setup URL must not stay an open door to all three codes — including
  // the admin code — for the rest of the token window.
  const setupClosed = !!school.setup_completed_at || !!school.admin_code_used_at

  return NextResponse.json({
    name: school.name,
    district: school.district,
    contactName: school.contact_name,
    contactEmail: school.contact_email,
    studentInviteCode: setupClosed ? null : school.student_invite_code,
    adminInviteCode: setupClosed ? null : school.admin_invite_code,
    advisorInviteCode: setupClosed ? null : school.advisor_invite_code,
    codesRedacted: setupClosed,
    expiresAt: school.setup_token_expires_at,
    completedAt: school.setup_completed_at,
  })
}

// POST: mark setup as complete.
// Requires a signed-in user: this is a state change that redacts the codes, so a
// stranger holding a forwarded setup URL must not be able to flip it (the GET is
// public for the IT contact to read codes; the write is not).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await setupLimiter.check(`ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const { token } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, status, setup_token_expires_at')
    .eq('setup_token', token)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid setup link' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not active' }, { status: 403 })
  }

  if (school.setup_token_expires_at && new Date(school.setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 })
  }

  await db
    .from('schools')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', school.id)

  return NextResponse.json({ ok: true })
}
