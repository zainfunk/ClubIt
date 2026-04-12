import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

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

  const updates: Record<string, string> = { name: name.trim() }
  if (district !== undefined) updates.district = district?.trim() ?? ''
  if (contactName !== undefined) updates.contact_name = contactName.trim()
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  // Get all users in this school to clean up their records
  const { data: schoolUsers } = await db
    .from('users')
    .select('id')
    .eq('school_id', id)

  const userIds = (schoolUsers ?? []).map((u) => u.id)

  // Get all clubs belonging to this school's users (advisors)
  const { data: clubs } = await db
    .from('clubs')
    .select('id')
    .in('advisor_id', userIds.length > 0 ? userIds : ['__none__'])

  const clubIds = (clubs ?? []).map((c) => c.id)

  // Delete in dependency order
  if (clubIds.length > 0) {
    await db.from('chat_messages').delete().in('club_id', clubIds)
    await db.from('memberships').delete().in('club_id', clubIds)
    await db.from('join_requests').delete().in('club_id', clubIds)
    await db.from('events').delete().in('club_id', clubIds)
    await db.from('club_news').delete().in('club_id', clubIds)
    await db.from('attendance_records').delete().in('club_id', clubIds)
    await db.from('attendance_sessions').delete().in('club_id', clubIds)
    await db.from('polls').delete().in('club_id', clubIds)
    await db.from('leadership_positions').delete().in('club_id', clubIds)
    await db.from('club_social_links').delete().in('club_id', clubIds)
    await db.from('meeting_times').delete().in('club_id', clubIds)
    await db.from('clubs').delete().in('id', clubIds)
  }

  // Delete school-level data
  await db.from('issue_reports').delete().eq('school_id', id)
  await db.from('notifications').delete().eq('school_id', id)

  // Unlink users from the school (don't delete the user records — they're Clerk accounts)
  if (userIds.length > 0) {
    await db.from('users').update({ school_id: null, role: 'student' }).in('id', userIds)
  }

  // Delete the school itself
  const { error } = await db.from('schools').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete school' }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: id })
}
