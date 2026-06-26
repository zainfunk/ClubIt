import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  // Un-strand everyone attached to this pending school FIRST: clear school_id
  // AND reset role to 'student' so the two never drift apart (a dangling staff
  // role with no school is the exact inconsistency the sign-in remediation
  // forbids). The FK is ON DELETE SET NULL, but that wouldn't reset role — and
  // we want these users able to re-onboard or join cleanly afterwards.
  const { error: detachErr } = await db
    .from('users')
    .update({ school_id: null, role: 'student' })
    .eq('school_id', id)

  if (detachErr) {
    console.error('reject: detaching users failed', detachErr)
    return NextResponse.json({ error: 'Failed to reject school' }, { status: 500 })
  }

  const { error } = await db
    .from('schools')
    .delete()
    .eq('id', id)
    .eq('status', 'pending') // can only reject pending schools

  if (error) return NextResponse.json({ error: 'Failed to reject school' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
