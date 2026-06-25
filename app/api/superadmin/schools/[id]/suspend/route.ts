import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'
import { audit } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  // Fetch current status to toggle
  const { data: school } = await db
    .from('schools')
    .select('status')
    .eq('id', id)
    .maybeSingle()

  if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 })

  // payment_paused → active is a superadmin override (no payment required)
  const newStatus = (school.status === 'suspended' || school.status === 'payment_paused')
    ? 'active'
    : 'suspended'

  const { error } = await db
    .from('schools')
    .update({ status: newStatus })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })

  await audit({
    action: newStatus === 'active' ? 'school.reactivated' : 'school.suspended',
    targetTable: 'schools',
    targetId: id,
    before: { status: school.status },
    after:  { status: newStatus },
    actorUserId: userId,
    actorRole: 'superadmin',
    request,
  })

  return NextResponse.json({ status: newStatus })
}
