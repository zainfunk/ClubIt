import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode, generateSetupToken, setupTokenExpiresAt } from '@/lib/schools-store'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role !== 'superadmin') return null
  return userId
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  if (school.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending schools can be approved' }, { status: 409 })
  }

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')
  const token = generateSetupToken()
  const tokenExpiry = setupTokenExpiresAt()

  const { data, error } = await db
    .from('schools')
    .update({
      status: 'active',
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
      setup_token: token,
      setup_token_expires_at: tokenExpiry,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to approve school' }, { status: 500 })

  return NextResponse.json({
    school: data,
    setupLink: `/setup/${token}`,
  })
}
