import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { sanitizeText } from '@/lib/sanitize'
import { audit } from '@/lib/audit'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (userRow?.role === 'superadmin') return userId

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role === 'superadmin') return userId

  return null
}

/** PATCH — rename a school (update name, district, contact info) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const { name, district, contactName, contactEmail } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'School name is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const updates: Record<string, string> = { name: sanitizeText(name.trim()) }
  if (district !== undefined) updates.district = district?.trim() ? sanitizeText(district.trim()) : ''
  if (contactName !== undefined) updates.contact_name = sanitizeText(contactName.trim())
  if (contactEmail !== undefined) updates.contact_email = contactEmail.trim()

  const { error } = await db
    .from('schools')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update school' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/** DELETE — permanently delete a school and all associated data */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  // Users in this school (kept — they're Clerk accounts — just unlinked).
  const { data: schoolUsers } = await db.from('users').select('id').eq('school_id', id)
  const userIds = (schoolUsers ?? []).map((u) => u.id)

  // Clubs by school_id (not advisor_id — that missed clubs whose advisor row
  // was already detached, leaving orphans and 500s on the final delete).
  const { data: clubs } = await db.from('clubs').select('id').eq('school_id', id)
  const clubIds = (clubs ?? []).map((c) => c.id)

  if (clubIds.length > 0) {
    // Grandchildren keyed by their own parent ids.
    const [{ data: polls }, { data: forms }] = await Promise.all([
      db.from('polls').select('id').in('club_id', clubIds),
      db.from('club_forms').select('id').in('club_id', clubIds),
    ])
    const pollIds = (polls ?? []).map((p) => p.id)
    const formIds = (forms ?? []).map((f) => f.id)

    if (pollIds.length > 0) {
      await db.from('poll_votes').delete().in('poll_id', pollIds)
      await db.from('poll_candidates').delete().in('poll_id', pollIds)
    }
    if (formIds.length > 0) {
      await db.from('form_responses').delete().in('form_id', formIds)
    }

    // Club-scoped children.
    await db.from('chat_message_reports').delete().eq('school_id', id)
    await db.from('chat_messages').delete().in('club_id', clubIds)
    await db.from('club_dues_payments').delete().in('club_id', clubIds)
    await db.from('user_badges').delete().in('club_id', clubIds)
    await db.from('memberships').delete().in('club_id', clubIds)
    await db.from('join_requests').delete().in('club_id', clubIds)
    await db.from('events').delete().in('club_id', clubIds)
    await db.from('club_news').delete().in('club_id', clubIds)
    await db.from('attendance_records').delete().in('club_id', clubIds)
    await db.from('attendance_sessions').delete().in('club_id', clubIds)
    await db.from('polls').delete().in('club_id', clubIds)
    await db.from('club_forms').delete().in('club_id', clubIds)
    await db.from('leadership_positions').delete().in('club_id', clubIds)
    await db.from('club_social_links').delete().in('club_id', clubIds)
    await db.from('meeting_times').delete().in('club_id', clubIds)
    await db.from('clubs').delete().in('id', clubIds)
  }

  // School elections + their children.
  const { data: elections } = await db.from('school_elections').select('id').eq('school_id', id)
  const electionIds = (elections ?? []).map((e) => e.id)
  if (electionIds.length > 0) {
    await db.from('election_votes').delete().in('election_id', electionIds)
    await db.from('election_candidates').delete().in('election_id', electionIds)
    await db.from('school_elections').delete().eq('school_id', id)
  }

  // Remaining school-level data.
  await db.from('issue_reports').delete().eq('school_id', id)
  await db.from('notifications').delete().eq('school_id', id)
  await db.from('subscriptions').delete().eq('school_id', id)
  await db.from('payment_events').delete().eq('school_id', id)
  await db.from('school_invites').delete().eq('school_id', id)
  await db.from('staff_access_requests').delete().eq('school_id', id)
  await db.from('admin_settings').delete().eq('school_id', id)

  // Unlink users (keep the Clerk-backed user rows; reset role so it can't dangle).
  if (userIds.length > 0) {
    await db.from('users').update({ school_id: null, role: 'student' }).in('id', userIds)
  }

  const { error } = await db.from('schools').delete().eq('id', id)
  if (error) {
    console.error('school delete error', error)
    return NextResponse.json({ error: 'Failed to delete school' }, { status: 500 })
  }

  await audit({
    action: 'school.deleted',
    targetTable: 'schools',
    targetId: id,
    after: { clubsDeleted: clubIds.length, usersUnlinked: userIds.length },
    actorUserId: userId,
    actorRole: 'superadmin',
    request,
  })

  return NextResponse.json({ success: true, deleted: id })
}
