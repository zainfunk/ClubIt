import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'
import { superadminLimiter } from '@/lib/rate-limit'
import { ClubRegistrationReviewSchema } from '@/lib/schemas'
import { createClub } from '@/lib/clubs'
import { REGISTRATION_COLUMNS, mapRegistrationRow, type RegistrationRow } from '@/lib/registrations'
import { audit } from '@/lib/audit'

/**
 * Reviewer queue for self-serve club registrations (open-registration schools).
 * Reviewers are platform superadmins (no new role; see plan).
 *
 *   GET  -> every request + requester identity + duplicate-name hints
 *   POST -> { id, action: 'approve' | 'deny', reason? }
 *             approve: create a real club via the shared createClub path,
 *                      owned by the requester; stamp created_club_id.
 *             deny:    record a required reason.
 *           Either way: notify the requester in-app.
 */

export const dynamic = 'force-dynamic'

/** Case/space-insensitive key for cheap duplicate-name detection. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

export async function GET() {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data: rows, error } = await db
    .from('club_registration_requests')
    .select(REGISTRATION_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('club-registrations: fetch failed', error)
    return NextResponse.json({ error: 'Failed to load registrations' }, { status: 500 })
  }

  const requests = (rows ?? []).map((row) => mapRegistrationRow(row as RegistrationRow))

  const requesterIds = [...new Set(requests.map((r) => r.requesterId))]
  const schoolIds = [...new Set(requests.map((r) => r.schoolId))]

  const [{ data: users }, { data: clubs }] = await Promise.all([
    requesterIds.length
      ? db.from('users').select('id, name, email').in('id', requesterIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; email: string | null }[] }),
    schoolIds.length
      ? db.from('clubs').select('id, name, school_id').in('school_id', schoolIds)
      : Promise.resolve({ data: [] as { id: string; name: string; school_id: string }[] }),
  ])

  const userById = new Map((users ?? []).map((u) => [u.id, u]))
  const clubsBySchool = new Map<string, { id: string; name: string }[]>()
  for (const club of clubs ?? []) {
    const list = clubsBySchool.get(club.school_id) ?? []
    list.push({ id: club.id, name: club.name })
    clubsBySchool.set(club.school_id, list)
  }

  // Warn the reviewer when a pending club name already exists (or is a
  // substring match) among live clubs in the same school.
  const enriched = requests.map((req) => {
    const requester = userById.get(req.requesterId)
    const target = normalizeName(req.clubName)
    const duplicateClubNames = (clubsBySchool.get(req.schoolId) ?? [])
      .filter((club) => {
        const existing = normalizeName(club.name)
        return existing === target || existing.includes(target) || target.includes(existing)
      })
      .map((club) => club.name)

    return {
      ...req,
      requesterName: requester?.name ?? null,
      requesterEmail: requester?.email ?? null,
      duplicateClubNames,
    }
  })

  // Pending first, then most recent.
  enriched.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return b.createdAt.localeCompare(a.createdAt)
  })

  return NextResponse.json({ requests: enriched })
}

export async function POST(request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rl = await superadminLimiter.check(`user:${userId}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const parsed = ClubRegistrationReviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const { id, action, reason } = parsed.data
  const db = createServiceClient()

  const { data: reqRow, error: fetchError } = await db
    .from('club_registration_requests')
    .select(REGISTRATION_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('club-registrations: fetch-one failed', fetchError)
    return NextResponse.json({ error: 'Failed to load the request' }, { status: 500 })
  }
  if (!reqRow) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  const req = mapRegistrationRow(reqRow as RegistrationRow)
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'This request has already been reviewed' }, { status: 409 })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    const result = await createClub(
      {
        schoolId: req.schoolId,
        name: req.clubName,
        description: req.description,
        ownerId: req.requesterId,
      },
      db,
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Conditional update guards against a concurrent second approval.
    const { data: updated, error: updateError } = await db
      .from('club_registration_requests')
      .update({
        status: 'approved',
        reviewer_id: userId,
        reviewed_at: now,
        created_club_id: result.club.id,
        updated_at: now,
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(REGISTRATION_COLUMNS)
      .maybeSingle()

    if (updateError || !updated) {
      console.error('club-registrations: approve stamp failed', updateError ?? 'no row updated')
      return NextResponse.json(
        {
          error: 'Club was created but the request could not be marked approved. Review it manually.',
          clubId: result.club.id,
        },
        { status: 500 },
      )
    }

    await db.from('notifications').insert({
      user_id: req.requesterId,
      school_id: req.schoolId,
      type: 'club_registration_approved',
      title: `“${req.clubName}” was approved`,
      body: 'Your club is live. Open your dashboard to manage it.',
      link: '/dashboard',
    })

    await audit({
      action: 'club_registration.approved',
      targetTable: 'club_registration_requests',
      targetId: id,
      before: { status: 'pending' },
      after: { status: 'approved', createdClubId: result.club.id },
      actorUserId: userId,
      actorRole: 'superadmin',
      request,
    })

    return NextResponse.json({
      ok: true,
      request: mapRegistrationRow(updated as RegistrationRow),
      club: result.club,
    })
  }

  // action === 'deny' (schema guarantees a non-empty reason here).
  const denialReason = reason!.trim()

  // Resolve the school's public slug so the "resubmit" link lands on the right
  // open-registration page (falls back to the generic /join).
  const { data: schoolRow } = await db
    .from('schools')
    .select('registration_slug')
    .eq('id', req.schoolId)
    .maybeSingle()
  const resubmitLink = schoolRow?.registration_slug ? `/join/${schoolRow.registration_slug}` : '/join'

  const { data: updated, error: updateError } = await db
    .from('club_registration_requests')
    .update({
      status: 'denied',
      denial_reason: denialReason,
      reviewer_id: userId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select(REGISTRATION_COLUMNS)
    .maybeSingle()

  if (updateError || !updated) {
    console.error('club-registrations: deny stamp failed', updateError ?? 'no row updated')
    return NextResponse.json({ error: 'Failed to record the denial' }, { status: 500 })
  }

  await db.from('notifications').insert({
    user_id: req.requesterId,
    school_id: req.schoolId,
    type: 'club_registration_denied',
    title: `“${req.clubName}” wasn't approved`,
    body: `Reason: ${denialReason}. You can revise and resubmit.`,
    link: resubmitLink,
  })

  await audit({
    action: 'club_registration.denied',
    targetTable: 'club_registration_requests',
    targetId: id,
    before: { status: 'pending' },
    after: { status: 'denied', denialReason },
    actorUserId: userId,
    actorRole: 'superadmin',
    request,
  })

  return NextResponse.json({ ok: true, request: mapRegistrationRow(updated as RegistrationRow) })
}
