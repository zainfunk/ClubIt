import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/user/sync
 *
 * Called by MockAuthProvider on sign-in to reliably resolve the user's
 * school context.  Uses the service-role key so RLS cannot block the read.
 *
 * 1. Upserts the user row (insert-only: won't overwrite an existing role).
 * 2. Reads the authoritative role + school from the DB.
 * 3. If the Clerk publicMetadata.role is stale, patches it to match the DB.
 * 4. Returns { role, schoolId, schoolName, schoolStatus, contactName,
 *      contactEmail, setupCompletedAt }.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()

  // Fetch Clerk user info for name/email
  const client = await clerkClient()
  const clerkUser = await client.users.getUser(userId)
  const name = clerkUser.fullName ?? clerkUser.username ?? 'New User'
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''
  const clerkRole = (clerkUser.publicMetadata?.role as string) || undefined

  // Ensure user row exists (don't overwrite existing role/school)
  await db.from('users').upsert(
    { id: userId, name, email, role: clerkRole ?? 'student' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  // Read the authoritative role and school from the DB
  const { data: userData } = await db
    .from('users')
    .select('role, school_id')
    .eq('id', userId)
    .maybeSingle()

  const dbRole = userData?.role ?? clerkRole ?? 'student'
  let schoolId = userData?.school_id ?? null

  // ── Self-heal: reconcile school membership across same-email accounts. ────
  // `users.id` is the Clerk id, so a person who signs in on a *second* Clerk
  // account (e.g. a different OAuth/login) gets a fresh row with
  // school_id=null and would see no school and an empty clubs list — even
  // though another of their accounts is already enrolled. If a sibling row
  // under the SAME, VERIFIED email is attached to exactly one school, inherit
  // that school_id here so the second login is never stranded.
  //
  // Safety: we copy ONLY the school_id (membership), never an elevated role.
  // School membership is grantable to anyone holding the multi-use student
  // code, so sharing "which school" between a human's own same-email accounts
  // is no escalation; inheriting admin/advisor across accounts would be, and is
  // deliberately not done. (We no longer require a verified email — entering a
  // code grants membership without verification, so reconcile matches that.) We
  // refuse to guess when siblings point at more than one distinct school.
  if (!schoolId && email) {
    // ilike = case-insensitive match; escape LIKE metacharacters (notably `_`,
    // which is common in generated emails like pw_adm_…@) so they're literal.
    const emailPattern = email.replace(/[\\%_]/g, '\\$&')
    const { data: siblings } = await db
      .from('users')
      .select('school_id')
      .ilike('email', emailPattern)
      .not('school_id', 'is', null)
      .neq('id', userId)

    const distinctSchoolIds = [...new Set((siblings ?? []).map((s) => s.school_id))]
    if (distinctSchoolIds.length === 1) {
      const inherited = distinctSchoolIds[0] as string
      const { data: healed } = await db
        .from('users')
        .update({ school_id: inherited })
        .eq('id', userId)
        .select('school_id')
        .maybeSingle()
      if (healed?.school_id) {
        schoolId = healed.school_id
        console.info(`sync: reconciled school_id for ${userId} from same-email sibling`)
      }
    } else if (distinctSchoolIds.length > 1) {
      console.warn(`sync: ambiguous school reconcile for ${email} (${distinctSchoolIds.length} schools) — skipping`)
    }
  }

  // If Clerk metadata is stale, fix it
  if (clerkRole !== dbRole) {
    try {
      await client.users.updateUserMetadata(userId, {
        publicMetadata: { ...clerkUser.publicMetadata, role: dbRole },
      })
    } catch (e) {
      console.warn('sync: failed to patch Clerk metadata', e)
    }
  }

  // If no school, return early
  if (!schoolId) {
    return NextResponse.json({ role: dbRole })
  }

  // Fetch school details
  const { data: school } = await db
    .from('schools')
    .select('name, contact_name, contact_email, status, setup_completed_at')
    .eq('id', schoolId)
    .maybeSingle()

  return NextResponse.json({
    role: dbRole,
    schoolId: school ? schoolId : null,
    schoolName: school?.name ?? null,
    schoolStatus: school?.status ?? null,
    contactName: school?.contact_name ?? null,
    contactEmail: school?.contact_email ?? null,
    setupCompletedAt: school?.setup_completed_at ?? null,
  })
}
