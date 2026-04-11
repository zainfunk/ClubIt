import { NextRequest, NextResponse } from 'next/server'
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

// PATCH — toggle is_open (close/reopen). Admin only, same-school only.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requester.role !== 'admin' && requester.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json() as { isOpen?: boolean }

  if (typeof body.isOpen !== 'boolean') {
    return NextResponse.json({ error: 'isOpen (boolean) is required' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: existing } = await db
    .from('school_elections')
    .select('school_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  }

  if (requester.role !== 'superadmin' && existing.school_id !== requester.schoolId) {
    return NextResponse.json({ error: 'You can only manage elections in your own school' }, { status: 403 })
  }

  const { error } = await db
    .from('school_elections')
    .update({ is_open: body.isOpen })
    .eq('id', id)

  if (error) {
    console.error('election update error', error)
    return NextResponse.json({ error: 'Failed to update election' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id, isOpen: body.isOpen })
}
