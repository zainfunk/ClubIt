import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode, generateSetupToken, setupTokenExpiresAt } from '@/lib/schools-store'
import { Role, SchoolStatus } from '@/types'

interface SchoolSnapshot {
  id: string
  name: string
  status: SchoolStatus
  studentInviteCode: string | null
  adminInviteCode: string | null
  setupLink: string | null
  setupTokenExpiresAt: string | null
  setupCompletedAt: string | null
}

function ensureDevelopment() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}

async function getRequester() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  return {
    userId,
    role: (userRow?.role as Role | undefined) ?? 'student',
    schoolId: userRow?.school_id ?? null,
  }
}

async function readSnapshot(userId: string): Promise<{ currentRole: Role; school: SchoolSnapshot | null }> {
  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.school_id) {
    return {
      currentRole: (userRow?.role as Role | undefined) ?? 'student',
      school: null,
    }
  }

  const { data: school } = await db
    .from('schools')
    .select('id, name, status, student_invite_code, admin_invite_code, setup_token, setup_token_expires_at, setup_completed_at')
    .eq('id', userRow.school_id)
    .maybeSingle()

  return {
    currentRole: (userRow.role as Role | undefined) ?? 'student',
    school: school
      ? {
          id: school.id,
          name: school.name,
          status: school.status as SchoolStatus,
          studentInviteCode: school.student_invite_code ?? null,
          adminInviteCode: school.admin_invite_code ?? null,
          setupLink: school.setup_token ? `/setup/${school.setup_token}` : null,
          setupTokenExpiresAt: school.setup_token_expires_at ?? null,
          setupCompletedAt: school.setup_completed_at ?? null,
        }
      : null,
  }
}

export async function GET() {
  const blocked = ensureDevelopment()
  if (blocked) return blocked

  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snapshot = await readSnapshot(requester.userId)
  return NextResponse.json(snapshot)
}

export async function POST(request: NextRequest) {
  const blocked = ensureDevelopment()
  if (blocked) return blocked

  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action, status, name } = await request.json()
  const db = createServiceClient()

  if (action === 'create_test_school') {
    if (requester.schoolId) {
      return NextResponse.json({ error: 'Leave your current school before creating another test school.' }, { status: 409 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(requester.userId)
    const contactName = clerkUser.fullName ?? clerkUser.username ?? 'Dev Tester'
    const contactEmail = clerkUser.primaryEmailAddress?.emailAddress ?? 'dev@clubit.app'

    const { data: school, error } = await db
      .from('schools')
      .insert({
        name: typeof name === 'string' && name.trim() ? name.trim() : `Dev School ${new Date().toLocaleDateString('en-US')}`,
        district: 'Local Development',
        contact_name: contactName,
        contact_email: contactEmail,
        status: 'active',
        student_invite_code: generateInviteCode('STU'),
        admin_invite_code: generateInviteCode('ADM'),
        setup_token: generateSetupToken(),
        setup_token_expires_at: setupTokenExpiresAt(),
      })
      .select('id')
      .single()

    if (error || !school) {
      console.error('dev school create error', error)
      return NextResponse.json({ error: 'Failed to create test school' }, { status: 500 })
    }

    await db.from('users').upsert(
      {
        id: requester.userId,
        name: contactName,
        email: contactEmail,
        role: 'admin',
        school_id: school.id,
      },
      { onConflict: 'id' }
    )
  } else if (action === 'set_status') {
    if (!requester.schoolId) {
      return NextResponse.json({ error: 'You do not belong to a school yet' }, { status: 400 })
    }

    if (!['pending', 'active', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: school } = await db
      .from('schools')
      .select('student_invite_code, admin_invite_code, setup_token, setup_token_expires_at')
      .eq('id', requester.schoolId)
      .maybeSingle()

    const update: Record<string, string | null> = { status }
    if (status === 'active') {
      update.student_invite_code = school?.student_invite_code ?? generateInviteCode('STU')
      update.admin_invite_code = school?.admin_invite_code ?? generateInviteCode('ADM')
      update.setup_token = school?.setup_token ?? generateSetupToken()
      update.setup_token_expires_at = school?.setup_token_expires_at ?? setupTokenExpiresAt()
    }

    const { error } = await db
      .from('schools')
      .update(update)
      .eq('id', requester.schoolId)

    if (error) {
      console.error('dev school status error', error)
      return NextResponse.json({ error: 'Failed to update school status' }, { status: 500 })
    }
  } else if (action === 'regenerate_codes') {
    if (!requester.schoolId) {
      return NextResponse.json({ error: 'You do not belong to a school yet' }, { status: 400 })
    }

    const { error } = await db
      .from('schools')
      .update({
        student_invite_code: generateInviteCode('STU'),
        admin_invite_code: generateInviteCode('ADM'),
      })
      .eq('id', requester.schoolId)

    if (error) {
      console.error('dev code regeneration error', error)
      return NextResponse.json({ error: 'Failed to regenerate invite codes' }, { status: 500 })
    }
  } else if (action === 'generate_setup_link') {
    if (!requester.schoolId) {
      return NextResponse.json({ error: 'You do not belong to a school yet' }, { status: 400 })
    }

    const { error } = await db
      .from('schools')
      .update({
        status: 'active',
        setup_token: generateSetupToken(),
        setup_token_expires_at: setupTokenExpiresAt(),
        setup_completed_at: null,
      })
      .eq('id', requester.schoolId)

    if (error) {
      console.error('dev setup link error', error)
      return NextResponse.json({ error: 'Failed to generate a setup link' }, { status: 500 })
    }
  } else if (action === 'set_my_role') {
    if (!requester.schoolId) {
      return NextResponse.json({ error: 'You do not belong to a school yet' }, { status: 400 })
    }

    if (!['student', 'advisor', 'admin'].includes(status)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(requester.userId)

    const { error } = await db
      .from('users')
      .upsert(
        {
          id: requester.userId,
          name: clerkUser.fullName ?? clerkUser.username ?? 'Dev Tester',
          email: clerkUser.primaryEmailAddress?.emailAddress ?? 'dev@clubit.app',
          role: status,
          school_id: requester.schoolId,
        },
        { onConflict: 'id' }
      )

    if (error) {
      console.error('dev role update error', error)
      return NextResponse.json({ error: 'Failed to update your saved school role' }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const snapshot = await readSnapshot(requester.userId)
  return NextResponse.json(snapshot)
}
