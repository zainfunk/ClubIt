import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { audit } from '@/lib/audit'
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
  return { userId, schoolId: userRow.school_id as string, role: userRow.role as Role }
}

function isManager(role: Role): boolean {
  return role === 'admin' || role === 'superadmin'
}

// GET — pending staff-access requests for the caller's school (admin only).
export async function GET() {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isManager(requester.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data: requests, error } = await db
    .from('staff_access_requests')
    .select('id, user_id, requested_role, status, created_at')
    .eq('school_id', requester.schoolId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('staff-requests list error', error)
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
  }

  // Attach requester name/email so the admin knows who they're approving.
  const userIds = Array.from(new Set((requests ?? []).map((r) => r.user_id)))
  const namesById: Record<string, { name: string; email: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await db.from('users').select('id, name, email').in('id', userIds)
    for (const u of users ?? []) namesById[u.id] = { name: u.name ?? 'Unknown', email: u.email ?? '' }
  }

  const out = (requests ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    requestedRole: r.requested_role as 'admin' | 'advisor',
    createdAt: r.created_at,
    name: namesById[r.user_id]?.name ?? 'Unknown',
    email: namesById[r.user_id]?.email ?? '',
  }))

  return NextResponse.json({ requests: out })
}

// POST — approve or deny a request (admin only, same-school only).
// Approving grants the role and consumes the matching single-use code.
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isManager(requester.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as {
    requestId?: string
    decision?: 'approve' | 'deny'
  }
  const { requestId, decision } = body
  if (!requestId || (decision !== 'approve' && decision !== 'deny')) {
    return NextResponse.json({ error: 'requestId and decision (approve|deny) are required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Atomically claim the request: only flip it if it's still pending, and only
  // within the caller's school. Two admins racing → exactly one wins.
  const { data: claimed, error: claimErr } = await db
    .from('staff_access_requests')
    .update({
      status: decision === 'approve' ? 'approved' : 'denied',
      decided_at: new Date().toISOString(),
      decided_by: requester.userId,
    })
    .eq('id', requestId)
    .eq('school_id', requester.schoolId)
    .eq('status', 'pending')
    .select('user_id, requested_role')
    .maybeSingle()

  if (claimErr) {
    console.error('staff-requests decision error', claimErr)
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
  if (!claimed) {
    return NextResponse.json({ error: 'Request not found or already decided' }, { status: 409 })
  }

  if (decision === 'deny') {
    await audit({
      action: 'staff_request.denied',
      targetTable: 'staff_access_requests',
      targetId: requestId,
      after: { userId: claimed.user_id, requestedRole: claimed.requested_role },
      actorUserId: requester.userId,
      actorRole: requester.role,
      request,
    })
    return NextResponse.json({ ok: true, decision: 'denied' })
  }

  // Approve: grant the role (pinned to this school) and sync Clerk metadata.
  const grantedRole = claimed.requested_role as 'admin' | 'advisor'
  const { error: roleErr } = await db
    .from('users')
    .update({ role: grantedRole })
    .eq('id', claimed.user_id)
    .eq('school_id', requester.schoolId)

  if (roleErr) {
    console.error('staff-requests role grant error', roleErr)
    return NextResponse.json({ error: 'Failed to grant the role' }, { status: 500 })
  }

  // Consume the matching single-use code now that a real elevation happened, so
  // any other leaked-code redemptions stop working (410 on next /api/join).
  const usedColumn = grantedRole === 'admin' ? 'admin_code_used_at' : 'advisor_code_used_at'
  const { error: useErr } = await db
    .from('schools')
    .update({ [usedColumn]: new Date().toISOString() })
    .eq('id', requester.schoolId)
    .is(usedColumn, null)
  if (useErr) console.warn('staff-requests: code consume warning', useErr)

  try {
    const client = await clerkClient()
    const target = await client.users.getUser(claimed.user_id)
    await client.users.updateUserMetadata(claimed.user_id, {
      publicMetadata: { ...target.publicMetadata, role: grantedRole },
    })
  } catch (metaErr) {
    console.warn('staff-requests: clerk metadata sync warning', metaErr)
  }

  await audit({
    action: 'staff_request.approved',
    targetTable: 'users',
    targetId: claimed.user_id,
    after: { grantedRole, requestId },
    actorUserId: requester.userId,
    actorRole: requester.role,
    request,
  })

  return NextResponse.json({ ok: true, decision: 'approved', grantedRole })
}
