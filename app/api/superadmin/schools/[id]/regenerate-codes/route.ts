import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/schools-store'

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

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')

  const { error } = await db
    .from('schools')
    .update({ student_invite_code: studentCode, admin_invite_code: adminCode })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to regenerate codes' }, { status: 500 })

  return NextResponse.json({ studentInviteCode: studentCode, adminInviteCode: adminCode })
}
