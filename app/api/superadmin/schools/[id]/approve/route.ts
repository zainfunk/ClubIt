import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode, generateSetupToken, setupTokenExpiresAt } from '@/lib/schools-store'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'
import { audit } from '@/lib/audit'

/**
 * POST /api/superadmin/schools/[id]/approve
 *
 * W2.3 (finding C-3): completes the pending-onboarding flow. In addition
 * to the previous behavior (status -> active, generate invite codes,
 * generate setup link), this route now ALSO promotes the user named in
 * `schools.requested_admin_user_id` to role='admin' and updates their
 * Clerk publicMetadata to match.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, status, requested_admin_user_id')
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

  // Conditional update protects against a concurrent approve.
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

  // Promote the requester to admin if there is one. (Older pending rows
  // created before W2.3 may not have requested_admin_user_id set; in that
  // case we just leave roles alone -- the admin invite code is the
  // fallback path.)
  let promotedAdminId: string | null = null
  if (school.requested_admin_user_id) {
    const requestedAdminId: string = school.requested_admin_user_id
    promotedAdminId = requestedAdminId
    // Grant admin AND pin the school in one id-scoped write, asserting a row
    // actually changed. (Same hardening as the staff-request approval: a
    // school_id-scoped UPDATE silently no-ops if the requester's school_id was
    // never persisted — see the sign-in remediation.)
    const { data: granted, error: roleErr } = await db
      .from('users')
      .update({ role: 'admin', school_id: id })
      .eq('id', requestedAdminId)
      .select('id')
      .maybeSingle()

    if (roleErr || !granted) {
      console.error('approve: role flip failed', roleErr ?? 'no row updated')
      // Don't 500 the whole flow; the school is already active. Return
      // a partial success so the operator can retry the role flip.
      return NextResponse.json({
        school: data,
        setupLink: `/setup/${token}`,
        warning: 'School approved but admin role promotion failed; promote the user manually.',
      })
    }

    // Sync Clerk metadata best-effort.
    try {
      const client = await clerkClient()
      const target = await client.users.getUser(requestedAdminId)
      await client.users.updateUserMetadata(requestedAdminId, {
        publicMetadata: { ...target.publicMetadata, role: 'admin' },
      })
    } catch (metaErr) {
      console.warn('approve: clerk metadata sync warning', metaErr)
    }
  } else {
    // No requested admin captured (older / edge pending rows). Warn if the
    // school would go live with nobody able to manage it, so the operator
    // promotes someone manually instead of silently activating an admin-less
    // school.
    const { count } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', id)
      .eq('role', 'admin')
    if (!count) {
      return NextResponse.json({
        school: data,
        setupLink: `/setup/${token}`,
        warning: 'School approved but no admin was assigned. Promote a user to admin or share the admin invite code.',
      })
    }
  }

  await audit({
    action: 'school.approved',
    targetTable: 'schools',
    targetId: id,
    before: { status: 'pending' },
    after:  { status: 'active', promotedAdminId },
    actorUserId: userId,
    actorRole: 'superadmin',
    request,
  })

  return NextResponse.json({
    school: data,
    setupLink: `/setup/${token}`,
    promotedAdminId,
  })
}
