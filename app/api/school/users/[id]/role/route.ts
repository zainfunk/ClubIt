import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

const MANAGED_ROLES: Role[] = ['student', 'advisor', 'admin']

async function getRequesterRoleAndSchool() {
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
  const requester = await getRequesterRoleAndSchool()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { role } = await request.json()

  if (!MANAGED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data: target } = await db
    .from('users')
    .select('id, school_id, role')
    .eq('id', id)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (!target.school_id) {
    return NextResponse.json({ error: 'This user is not assigned to a school yet' }, { status: 400 })
  }

  if (requester.role !== 'superadmin' && requester.schoolId !== target.school_id) {
    return NextResponse.json({ error: 'You can only manage users in your own school' }, { status: 403 })
  }

  if (target.role === role) {
    return NextResponse.json({ ok: true, userId: target.id, role })
  }

  if (target.role === 'admin' && role !== 'admin') {
    const { count } = await db
      .from('users')
      .select('id', { head: true, count: 'exact' })
      .eq('school_id', target.school_id)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Each school needs at least one admin. Promote another admin first.' },
        { status: 409 }
      )
    }
  }

  const { error } = await db
    .from('users')
    .update({ role })
    .eq('id', target.id)

  if (error) {
    console.error('role update error', error)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId: target.id, role })
}
