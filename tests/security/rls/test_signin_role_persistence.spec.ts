/**
 * Regression — sign-in / role association persistence.
 *
 * Guards the "cofounder gets re-prompted for a code" bug and its cascade:
 *  - /api/join's elevated (admin/advisor) path must persist users.school_id to
 *    the DB (not just localStorage), so a return visit on a fresh device is NOT
 *    re-prompted for a code.  (I1)
 *  - /api/school/staff-requests approval must grant the role scoped by id only.
 *    The old code scoped the UPDATE by school_id, which silently matched ZERO
 *    rows whenever school_id was never set — granting nothing yet burning the
 *    single-use code.  (I2)
 *
 * Same idiom as test_w2_3_pending_onboarding: replicate the route SQL inline via
 * the service-role client (Clerk-bridged HTTP auth is impractical to mock here),
 * and assert post-state. Skipped unless SUPABASE_TEST_* env vars are present.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_TEST_URL
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const HAVE_TEST_DB = !!(URL && SERVICE)

const runId = randomUUID().slice(0, 8)
const SCHOOL = `00000000-0000-4000-8000-${runId.padStart(12, '0').slice(-12)}`
const APPROVER = `test-signin-${runId}-admin`
const JOINER = `test-signin-${runId}-join1`   // exercises I1
const JOINER2 = `test-signin-${runId}-join2`  // exercises the I2 no-op + fix
const REQ1 = `req-test-signin-${runId}-1`

describe.skipIf(!HAVE_TEST_DB)('Sign-in & role persistence (cofounder re-prompt regression)', () => {
  let admin: SupabaseClient

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    await admin.from('schools').insert({
      id: SCHOOL,
      name: `signin-regress ${runId}`,
      contact_name: 'C',
      contact_email: `c-${runId}@example.test`,
      status: 'active',
      admin_invite_code: `ADM-${runId}`,
      advisor_invite_code: `ADV-${runId}`,
      student_invite_code: `STU-${runId}`,
    }).throwOnError()

    // Post-/api/user/sync state: rows exist with NO school_id yet (the trigger
    // for the bug — sync creates the row before the user redeems a code).
    await admin.from('users').insert([
      { id: APPROVER, name: 'Approver', email: `a-${runId}@x.test`, role: 'admin', school_id: SCHOOL },
      { id: JOINER, name: 'Joiner One', email: `j1-${runId}@x.test`, role: 'student', school_id: null },
      { id: JOINER2, name: 'Joiner Two', email: `j2-${runId}@x.test`, role: 'student', school_id: null },
    ]).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('staff_access_requests').delete().eq('school_id', SCHOOL)
    await admin.from('users').delete().in('id', [APPROVER, JOINER, JOINER2])
    await admin.from('schools').delete().eq('id', SCHOOL)
  })

  it('I1: staff join persists school_id, so a return visit is not re-prompted', async () => {
    // Replicates the FIXED /api/join elevated path: attach the school NOW
    // (id-scoped), then file the pending staff request.
    await admin.from('users').update({ school_id: SCHOOL }).eq('id', JOINER).throwOnError()
    await admin.from('staff_access_requests').insert({
      id: REQ1, user_id: JOINER, school_id: SCHOOL, requested_role: 'advisor', status: 'pending',
    }).throwOnError()

    // Simulates /api/user/sync on a fresh device reading the DB.
    const { data: u } = await admin.from('users').select('school_id, role').eq('id', JOINER).single()
    expect(u?.school_id).toBe(SCHOOL)   // not null → routed in-app, NOT to /join
    expect(u?.role).toBe('student')     // role still student until approval
  })

  it('root cause: a school_id-scoped grant silently no-ops when school_id is null', async () => {
    // JOINER2 mimics the pre-fix state: never attached to the school.
    const { data, error } = await admin
      .from('users')
      .update({ role: 'advisor' })
      .eq('id', JOINER2)
      .eq('school_id', SCHOOL)   // the OLD buggy filter
      .select('id')
    expect(error).toBeNull()
    expect(data?.length ?? 0).toBe(0)  // 0 rows changed — the silent no-op

    const { data: u } = await admin.from('users').select('role').eq('id', JOINER2).single()
    expect(u?.role).toBe('student')    // role was never granted
  })

  it('I2: the fixed approval grants role + school_id scoped by id (and self-heals)', async () => {
    const { data, error } = await admin
      .from('users')
      .update({ role: 'advisor', school_id: SCHOOL })  // the FIX: set both, scope by id
      .eq('id', JOINER2)
      .select('id')
    expect(error).toBeNull()
    expect(data?.length).toBe(1)       // a row actually changed → safe to consume code

    const { data: u } = await admin.from('users').select('role, school_id').eq('id', JOINER2).single()
    expect(u?.role).toBe('advisor')
    expect(u?.school_id).toBe(SCHOOL)  // consistent — survives re-sign-in, no re-prompt
  })
})

/**
 * Regression — same-email school reconcile (the /api/user/sync self-heal).
 *
 * Guards the "clubs are simply not there" bug: a person who signs in on a
 * SECOND Clerk account (different users.id, same verified email) lands on a row
 * with school_id=null, so /api/school/clubs short-circuits to an empty list.
 * sync now inherits school_id from a same-email sibling when it is unambiguous.
 * Copies membership ONLY (never an elevated role); stays null when there is no
 * sibling school or when siblings disagree (school switching is unsupported).
 */
const RSCHOOL_A = `00000000-0000-4000-8001-${runId.padStart(12, '0').slice(-12)}`
const RSCHOOL_B = `00000000-0000-4000-8002-${runId.padStart(12, '0').slice(-12)}`
const SHARED_EMAIL = `recon-shared-${runId}@x.test`
const AMBIG_EMAIL = `recon-ambig-${runId}@x.test`
const UNIQUE_EMAIL = `recon-unique-${runId}@x.test`
const R_SIBLING = `test-recon-${runId}-sib`        // enrolled, admin role
const R_STRANDED = `test-recon-${runId}-stranded`  // same email, null school
const R_UNIQUE = `test-recon-${runId}-unique`      // no sibling at all
const R_AMBIG_A = `test-recon-${runId}-ambigA`
const R_AMBIG_B = `test-recon-${runId}-ambigB`
const R_AMBIG_S = `test-recon-${runId}-ambigS`

// Mirrors the reconcile in app/api/user/sync/route.ts exactly.
async function reconcileSchool(db: SupabaseClient, userId: string, email: string) {
  const emailPattern = email.replace(/[\\%_]/g, '\\$&')
  const { data: siblings } = await db
    .from('users')
    .select('school_id')
    .ilike('email', emailPattern)
    .not('school_id', 'is', null)
    .neq('id', userId)
  const distinct = [...new Set((siblings ?? []).map((s) => s.school_id))]
  if (distinct.length === 1) {
    await db.from('users').update({ school_id: distinct[0] }).eq('id', userId).throwOnError()
    return distinct[0] as string
  }
  return null
}

describe.skipIf(!HAVE_TEST_DB)('Same-email school reconcile (sync self-heal)', () => {
  let admin: SupabaseClient
  const allUsers = [R_SIBLING, R_STRANDED, R_UNIQUE, R_AMBIG_A, R_AMBIG_B, R_AMBIG_S]

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })
    for (const [id, name] of [[RSCHOOL_A, 'recon-A'], [RSCHOOL_B, 'recon-B']] as const) {
      await admin.from('schools').insert({
        id, name: `${name} ${runId}`, contact_name: 'C', contact_email: `${name}-${runId}@x.test`,
        status: 'active', admin_invite_code: `ADM-${name}-${runId}`,
        advisor_invite_code: `ADV-${name}-${runId}`, student_invite_code: `STU-${name}-${runId}`,
      }).throwOnError()
    }
    await admin.from('users').insert([
      // shared email: one enrolled (admin), one stranded (student)
      { id: R_SIBLING, name: 'Sib', email: SHARED_EMAIL, role: 'admin', school_id: RSCHOOL_A },
      { id: R_STRANDED, name: 'Stranded', email: SHARED_EMAIL, role: 'student', school_id: null },
      // unique email: nothing to inherit
      { id: R_UNIQUE, name: 'Unique', email: UNIQUE_EMAIL, role: 'student', school_id: null },
      // ambiguous: two siblings at two different schools
      { id: R_AMBIG_A, name: 'AmbA', email: AMBIG_EMAIL, role: 'student', school_id: RSCHOOL_A },
      { id: R_AMBIG_B, name: 'AmbB', email: AMBIG_EMAIL, role: 'student', school_id: RSCHOOL_B },
      { id: R_AMBIG_S, name: 'AmbS', email: AMBIG_EMAIL, role: 'student', school_id: null },
    ]).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('users').delete().in('id', allUsers)
    await admin.from('schools').delete().in('id', [RSCHOOL_A, RSCHOOL_B])
  })

  it('inherits school_id from an unambiguous same-email sibling', async () => {
    const inherited = await reconcileSchool(admin, R_STRANDED, SHARED_EMAIL)
    expect(inherited).toBe(RSCHOOL_A)
    const { data: u } = await admin.from('users').select('role, school_id').eq('id', R_STRANDED).single()
    expect(u?.school_id).toBe(RSCHOOL_A)  // can now see the school's clubs
    expect(u?.role).toBe('student')       // role NOT elevated from the admin sibling
  })

  it('stays null when the email has no enrolled sibling', async () => {
    const inherited = await reconcileSchool(admin, R_UNIQUE, UNIQUE_EMAIL)
    expect(inherited).toBeNull()
    const { data: u } = await admin.from('users').select('school_id').eq('id', R_UNIQUE).single()
    expect(u?.school_id).toBeNull()
  })

  it('refuses to guess when siblings point at different schools', async () => {
    const inherited = await reconcileSchool(admin, R_AMBIG_S, AMBIG_EMAIL)
    expect(inherited).toBeNull()
    const { data: u } = await admin.from('users').select('school_id').eq('id', R_AMBIG_S).single()
    expect(u?.school_id).toBeNull()
  })
})

describe.skipIf(HAVE_TEST_DB)('Sign-in & role persistence (skipped - no test DB env)', () => {
  it('placeholder', () => { expect(true).toBe(true) })
})
