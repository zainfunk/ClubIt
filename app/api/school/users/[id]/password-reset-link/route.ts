import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'
import { audit } from '@/lib/audit'

// POST /api/school/users/[id]/password-reset-link
//
// Generates a one-time Clerk sign-in link the admin can share with a student
// who has lost their password. The student clicks it, gets signed in without a
// password, and can then set a new one from their account settings. The admin
// never sees the password (Clerk only stores hashes; no one can).
//
// Restricted to admin/superadmin in the target user's school.

const RESET_LINK_TTL_SECONDS = 60 * 60 // 1 hour

async function getRequester() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const role = (userRow?.role as Role | undefined) ?? (clerkUser.publicMetadata?.role as Role | undefined) ?? 'student'

  return {
    userId,
    role,
    schoolId: userRow?.school_id ?? null,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  const db = createServiceClient()
  const { data: target } = await db
    .from('users')
    .select('id, school_id, role')
    .eq('id', id)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (requester.role !== 'superadmin' && requester.schoolId !== target.school_id) {
    return NextResponse.json({ error: 'You can only manage users in your own school' }, { status: 403 })
  }

  // A sign-in token logs the holder in AS the target with no password — i.e.
  // full account takeover. Restrict it to students (its stated purpose: a
  // student who lost their password). Without this, an admin could mint a link
  // to sign in as another admin/advisor. Staff reset their own password via
  // Clerk's normal flow.
  if (target.role !== 'student') {
    return NextResponse.json(
      { error: 'Password reset links can only be issued for student accounts.' },
      { status: 403 },
    )
  }

  let signInToken
  try {
    const client = await clerkClient()
    signInToken = await client.signInTokens.createSignInToken({
      userId: target.id,
      expiresInSeconds: RESET_LINK_TTL_SECONDS,
    })
  } catch (err) {
    console.error('sign-in token error', err)
    return NextResponse.json({ error: 'Could not create reset link' }, { status: 500 })
  }

  await audit({
    action: 'user.password_reset_link_created',
    targetTable: 'users',
    targetId: target.id,
    actorUserId: requester.userId,
    actorRole: requester.role,
    request,
  })

  return NextResponse.json({
    url: signInToken.url,
    expiresInSeconds: RESET_LINK_TTL_SECONDS,
  })
}
