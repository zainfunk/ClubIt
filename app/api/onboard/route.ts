import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/schools-store'
import { sanitizeText } from '@/lib/sanitize'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, district, contactName, contactEmail } = body

  if (!name || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)

  // Check if this user already has a pending/active school
  const { data: existingUser } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.school_id) {
    return NextResponse.json({ error: 'You are already enrolled in a school' }, { status: 409 })
  }

  // Auto-approve: create as active with invite codes ready to share.
  // The onboarding user becomes the admin immediately; superadmin can still suspend later.
  const { data: school, error } = await db
    .from('schools')
    .insert({
      name: sanitizeText(name.trim()),
      district: district?.trim() ? sanitizeText(district.trim()) : null,
      contact_name: sanitizeText(contactName.trim()),
      contact_email: contactEmail.trim().toLowerCase(),
      status: 'active',
      student_invite_code: generateInviteCode('STU'),
      admin_invite_code: generateInviteCode('ADM'),
      advisor_invite_code: generateInviteCode('ADV'),
    })
    .select()
    .single()

  if (error) {
    console.error('onboard error', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  // Tag the submitting user as admin of this school (pending)
  const { error: userError } = await db
    .from('users')
    .upsert(
      {
        id: userId,
        name: clerkUser.fullName ?? clerkUser.username ?? contactName.trim(),
        email: clerkUser.primaryEmailAddress?.emailAddress ?? contactEmail.trim().toLowerCase(),
        school_id: school.id,
        role: 'admin',
      },
      { onConflict: 'id' }
    )

  if (userError) {
    console.error('onboard user save error', userError)
    return NextResponse.json({ error: 'Failed to save your school admin role' }, { status: 500 })
  }

  try {
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        role: 'admin',
      },
    })
  } catch (metadataError) {
    console.warn('onboard metadata sync warning', metadataError)
  }

  return NextResponse.json({ schoolId: school.id })
}
