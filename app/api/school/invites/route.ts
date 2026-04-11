import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

async function getRequester() {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!userRow?.school_id) return null

  return {
    userId,
    schoolId: userRow.school_id as string,
    role: userRow.role as Role,
  }
}

// GET — admin-only: fetch the three invite codes for the caller's school
export async function GET() {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('schools')
    .select('name, student_invite_code, admin_invite_code, advisor_invite_code')
    .eq('id', requester.schoolId)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to load invite codes' }, { status: 500 })
  }

  return NextResponse.json({
    schoolName: data.name,
    studentCode: data.student_invite_code ?? null,
    advisorCode: data.advisor_invite_code ?? null,
    adminCode: data.admin_invite_code ?? null,
  })
}
