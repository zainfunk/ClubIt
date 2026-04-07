import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code } = await request.json()
  if (!code) return NextResponse.json({ error: 'Invite code required' }, { status: 400 })

  const normalised = (code as string).trim().toUpperCase()
  const db = createServiceClient()

  // Look up school by student or admin invite code
  const { data: school } = await db
    .from('schools')
    .select('id, name, status, student_invite_code, admin_invite_code')
    .or(`student_invite_code.eq.${normalised},admin_invite_code.eq.${normalised}`)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not currently active' }, { status: 403 })
  }

  const isAdminCode = school.admin_invite_code === normalised
  const role = isAdminCode ? 'admin' : 'student'

  // Assign user to this school
  await db
    .from('users')
    .upsert({ id: userId, school_id: school.id, role }, { onConflict: 'id' })

  return NextResponse.json({ schoolId: school.id, schoolName: school.name, role })
}
