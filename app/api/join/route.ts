import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

const ROLE_PRIORITY: Record<Role, number> = {
  student: 0,
  advisor: 1,
  admin: 2,
  superadmin: 3,
}

function keepHigherRole(currentRole: Role | undefined, incomingRole: Role) {
  if (!currentRole) return incomingRole
  return ROLE_PRIORITY[currentRole] >= ROLE_PRIORITY[incomingRole] ? currentRole : incomingRole
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await request.json()
  if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 })

  const normalised = (code as string).trim().toUpperCase()
  const db = createServiceClient()

  // Look up school by student, advisor, or admin invite code
  const { data: school } = await db
    .from('schools')
    .select('id, name, status, student_invite_code, admin_invite_code, advisor_invite_code')
    .or(`student_invite_code.eq.${normalised},admin_invite_code.eq.${normalised},advisor_invite_code.eq.${normalised}`)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
  }

  const isAdminCode = school.admin_invite_code === normalised
  const isAdvisorCode = school.advisor_invite_code === normalised
  const incomingRole: Role = isAdminCode ? 'admin' : isAdvisorCode ? 'advisor' : 'student'

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

  const role = keepHigherRole(existingUser?.role as Role | undefined, incomingRole)
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const name = clerkUser.fullName ?? clerkUser.username ?? existingUser?.role ?? 'New User'
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''

  // Assign user to this school and persist the promoted role.
  const { error } = await db
    .from('users')
    .upsert(
      {
        id: userId,
        name,
        email,
        school_id: school.id,
        role,
      },
      { onConflict: 'id' }
    )

  if (error) {
    console.error('join upsert error', error)
    return NextResponse.json({ error: 'Failed to save your school role. Please try the code again.' }, { status: 500 })
  }

  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role,
      },
    })
  } catch (metadataError) {
    console.warn('join metadata sync warning', metadataError)
  }

  return NextResponse.json({
    schoolId: school.id,
    schoolName: school.name,
    schoolStatus: school.status,
    role,
  })
}
