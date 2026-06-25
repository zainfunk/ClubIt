import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/school/leave — self-service "leave school".
 *
 * Resets the caller to a clean, onboardable state, scoped by id, via the
 * service-role client (iOS-safe — no client RLS / localStorage authority):
 *   - clears users.school_id AND resets role to 'student'. school_id and role
 *     always move together; a dangling staff role with no school is exactly the
 *     inconsistency the sign-in remediation forbids.
 *   - removes the user's club memberships and any pending staff request.
 *
 * Guard: a sole school admin cannot leave and orphan a live tenant full of
 * student records — mirrors the /api/user/delete admin-transfer guard. They
 * must add another admin (or transfer ownership) first. Superadmins are global
 * and keep their role.
 *
 * Note: if the same human has *another* account (same verified email) still
 * enrolled, the /api/user/sync reconcile may re-attach this account's school_id
 * (as a student) on next sign-in — that's correct: they still have an enrolled
 * identity. Role is never restored by that path.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: user } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  // Idempotent: not in a school → nothing to do.
  if (!user?.school_id) {
    return NextResponse.json({ ok: true, alreadyLeft: true })
  }

  const schoolId = user.school_id

  // Don't orphan a school that would be left with no admin.
  if (user.role === 'admin') {
    const { count } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('role', 'admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        {
          status: 'sole_admin',
          message:
            'You are the only admin of this school. Add another admin (or transfer ownership) before leaving, so the school isn’t left without an administrator.',
        },
        { status: 409 },
      )
    }
  }

  // Authoritative detach: clear school AND reset role so the two stay
  // consistent. Superadmins keep their global role. Asserted by row-count so a
  // silent 0-row no-op can't pass as success.
  const nextRole = user.role === 'superadmin' ? 'superadmin' : 'student'
  const { data: updated, error } = await db
    .from('users')
    .update({ school_id: null, role: nextRole })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    console.error('leave school: detach failed', error)
    return NextResponse.json({ error: 'Failed to leave the school. Please try again.' }, { status: 500 })
  }

  // Best-effort cleanup of school-scoped rows (the detach above is the
  // authoritative state change; these just tidy up).
  const { error: memErr } = await db.from('memberships').delete().eq('user_id', userId)
  if (memErr) console.error('leave school: clearing memberships failed', memErr)
  const { error: reqErr } = await db.from('staff_access_requests').delete().eq('user_id', userId)
  if (reqErr) console.error('leave school: clearing staff requests failed', reqErr)

  // Mirror role to Clerk best-effort so routing metadata doesn't lag the DB.
  try {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: nextRole },
    })
  } catch (e) {
    console.warn('leave school: clerk metadata sync warning', e)
  }

  return NextResponse.json({ ok: true })
}
