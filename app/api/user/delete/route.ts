import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/user/delete — self-service account deletion.
 *
 * Required by App Store Review Guideline 5.1.1(v): an app that lets users
 * create an account must let them delete it from inside the app.
 *
 * We cannot hard-DELETE the users row: chat_messages, poll/election votes,
 * events, etc. reference users(id) with ON DELETE NO ACTION (RESTRICT), and the
 * secret-ballot design relies on those vote rows. So deletion is:
 *   1. Delete the Clerk identity (removes login + Clerk-held PII). Done FIRST so
 *      that if it fails we abort before touching the database.
 *   2. Cascade-delete the user's personal rows.
 *   3. Scrub the users row to an anonymized, login-less tombstone.
 *
 * School admins own a tenant; deleting them would orphan a live school, so their
 * request is recorded for an ownership-transfer/closure flow (still initiated
 * in-app, which is what Apple requires) rather than executed blindly.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  const { data: user } = await db
    .from('users')
    .select('role, school_id, name, email')
    .eq('id', userId)
    .maybeSingle()

  // Admins/superadmins manage a school. Record the request (so deletion is
  // initiated in-app) and route them to ownership transfer instead of orphaning
  // a tenant full of student records.
  if (user?.role === 'admin' || user?.role === 'superadmin') {
    await db.from('issue_reports').insert({
      school_id: user.school_id ?? null,
      reporter_id: userId,
      reporter_name: user.name ?? 'Account holder',
      reporter_email: user.email ?? '',
      message:
        'ACCOUNT DELETION REQUEST (admin). This account manages a school and ' +
        'requires ownership transfer or school closure before deletion. ' +
        'Submitted from the in-app Delete Account flow.',
      status: 'open',
    })
    return NextResponse.json(
      {
        status: 'admin_requires_transfer',
        message:
          'Because this account manages a school, deletion needs ownership ' +
          'transfer or school closure first. We’ve logged your request and ' +
          'will follow up at your contact email.',
      },
      { status: 409 },
    )
  }

  // 1. Remove the Clerk identity first. If this throws, nothing else runs.
  const client = await clerkClient()
  await client.users.deleteUser(userId)

  // 2. Delete the user's personal rows (best-effort, dependency-safe order).
  const personalTables = [
    'memberships',
    'join_requests',
    'attendance_records',
    'form_responses',
    'user_profiles',
    'user_overrides',
    'user_privacy_settings',
    'user_badges',
  ] as const
  for (const table of personalTables) {
    const { error } = await db.from(table).delete().eq('user_id', userId)
    if (error) console.error(`account-delete: failed clearing ${table}`, error)
  }

  // 3. Scrub the users row to an anonymized tombstone. The row must survive so
  //    vote / chat foreign keys stay valid, but it holds no PII and can't log in
  //    (the Clerk identity is gone).
  const { error: scrubError } = await db
    .from('users')
    .update({
      name: 'Deleted user',
      email: `deleted-${userId}@clubit.invalid`,
      avatar_url: null,
      school_id: null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (scrubError) {
    console.error('account-delete: failed scrubbing users row', scrubError)
    // Clerk identity is already gone (login impossible), so report partial
    // success rather than implying the account still exists.
    return NextResponse.json(
      { status: 'deleted', warning: 'Some records may take longer to clear.' },
    )
  }

  return NextResponse.json({ status: 'deleted' })
}
