/**
 * Open-registration RLS — verify migration 0021_open_registration.sql enforces
 * the trust model for `club_registration_requests`:
 *
 *   - club_reg_select     requester reads ONLY their own rows; superadmins read
 *                         everything; unrelated students read nothing.
 *   - club_reg_insert_own a requester can create a row only for THEMSELVES, only
 *                         pending, only in the school they belong to.
 *   - club_reg_update_own a requester edits only their OWN pending row and it
 *                         must STAY pending — flipping to 'approved' is blocked
 *                         (this is the self-approval guard).
 *   - club_reg_review     superadmins can update any row (approve/deny path).
 *
 * Setup mirrors the other RLS specs (W2.1 / W1.4): mint HS256 JWTs whose `sub`
 * is the seeded user id, drive the anon client with that bearer, and assert
 * allow/deny. Needs SUPABASE_TEST_URL, _ANON_KEY, _SERVICE_ROLE_KEY,
 * _JWT_SECRET; runs via `npm run test:rls`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createHmac, randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_TEST_URL
const ANON = process.env.SUPABASE_TEST_ANON_KEY
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
const JWT_SECRET = process.env.SUPABASE_TEST_JWT_SECRET

const HAVE_TEST_DB = !!(URL && ANON && SERVICE && JWT_SECRET)

const runId = randomUUID().slice(0, 8)
const SCHOOL_A = `00000000-0000-4000-8000-0000${runId}`.slice(0, 36)
const SCHOOL_B = `00000000-0000-4000-8001-0000${runId}`.slice(0, 36)

const U = {
  superA:   `test-openreg-${runId}-super`,
  studentA: `test-openreg-${runId}-student-a`,
  studentA2: `test-openreg-${runId}-student-a2`,
  studentB: `test-openreg-${runId}-student-b`,
} as const

const REQ_A = `clubreg-${runId}-a`       // studentA, pending (select + update tests)
const REQ_B = `clubreg-${runId}-b`       // studentB, pending (superadmin review test)

function mintJwt(sub: string): string {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    sub, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600,
  })).toString('base64url')
  const sig = createHmac('sha256', JWT_SECRET!).update(`${head}.${payload}`).digest('base64url')
  return `${head}.${payload}.${sig}`
}

function clientAs(userId: string): SupabaseClient {
  return createClient(URL!, ANON!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${mintJwt(userId)}` } },
  })
}

function baseRow(id: string, requesterId: string, schoolId: string) {
  const now = new Date().toISOString()
  return {
    id,
    school_id: schoolId,
    requester_id: requesterId,
    club_name: `Club ${id}`,
    description: 'A brand new club',
    requester_role: 'president',
    status: 'pending',
    created_at: now,
    updated_at: now,
  }
}

describe.skipIf(!HAVE_TEST_DB)('0021: club_registration_requests RLS', () => {
  let admin: SupabaseClient

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    await admin.from('schools').insert([
      { id: SCHOOL_A, name: `OpenReg A ${runId}`, contact_name: 'A', contact_email: `a-${runId}@example.test`, status: 'active', open_registration: true, allowed_email_domain: 'a.test', registration_slug: `a-${runId}` },
      { id: SCHOOL_B, name: `OpenReg B ${runId}`, contact_name: 'B', contact_email: `b-${runId}@example.test`, status: 'active' },
    ]).throwOnError()

    await admin.from('users').insert([
      { id: U.superA,    name: 'Super',      email: `s-${runId}@a.test`,  role: 'superadmin', school_id: null },
      { id: U.studentA,  name: 'Student A',  email: `sa-${runId}@a.test`, role: 'student',    school_id: SCHOOL_A },
      { id: U.studentA2, name: 'Student A2', email: `sa2-${runId}@a.test`, role: 'student', school_id: SCHOOL_A },
      { id: U.studentB,  name: 'Student B',  email: `sb-${runId}@b.test`, role: 'student',    school_id: SCHOOL_B },
    ]).throwOnError()

    await admin.from('club_registration_requests').insert([
      baseRow(REQ_A, U.studentA, SCHOOL_A),
      baseRow(REQ_B, U.studentB, SCHOOL_B),
    ]).throwOnError()
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('club_registration_requests').delete().in('requester_id', Object.values(U))
    await admin.from('users').delete().in('id', Object.values(U))
    await admin.from('schools').delete().in('id', [SCHOOL_A, SCHOOL_B])
  })

  // -------------------------------------------------------------------------
  // SELECT
  // -------------------------------------------------------------------------
  describe('club_reg_select', () => {
    it('requester sees their own request', async () => {
      const { data } = await clientAs(U.studentA).from('club_registration_requests').select('id').eq('id', REQ_A)
      expect(data?.length).toBe(1)
    })

    it('an unrelated student in the same school does NOT see it', async () => {
      const { data } = await clientAs(U.studentA2).from('club_registration_requests').select('id').eq('id', REQ_A)
      expect(data?.length ?? 0).toBe(0)
    })

    it('a student in another school does NOT see it', async () => {
      const { data } = await clientAs(U.studentB).from('club_registration_requests').select('id').eq('id', REQ_A)
      expect(data?.length ?? 0).toBe(0)
    })

    it('superadmin sees every request', async () => {
      const { data } = await clientAs(U.superA).from('club_registration_requests').select('id').in('id', [REQ_A, REQ_B])
      expect(data?.length).toBe(2)
    })
  })

  // -------------------------------------------------------------------------
  // INSERT
  // -------------------------------------------------------------------------
  describe('club_reg_insert_own', () => {
    it('a requester can create their OWN pending request in their school', async () => {
      const id = `clubreg-${runId}-a2own`
      const { error } = await clientAs(U.studentA2).from('club_registration_requests').insert(baseRow(id, U.studentA2, SCHOOL_A))
      expect(error, error?.message).toBeNull()
      await admin.from('club_registration_requests').delete().eq('id', id)
    })

    it('cannot create a request for SOMEONE ELSE', async () => {
      const id = `clubreg-${runId}-forgery`
      const { error } = await clientAs(U.studentA2).from('club_registration_requests').insert(baseRow(id, U.studentA, SCHOOL_A))
      expect(error).not.toBeNull()
    })

    it('cannot create a request pre-set to approved', async () => {
      const id = `clubreg-${runId}-preapprove`
      const { error } = await clientAs(U.studentA2).from('club_registration_requests').insert({
        ...baseRow(id, U.studentA2, SCHOOL_A), status: 'approved',
      })
      expect(error).not.toBeNull()
    })

    it('cannot create a request in a school they do not belong to', async () => {
      const id = `clubreg-${runId}-wrongschool`
      const { error } = await clientAs(U.studentB).from('club_registration_requests').insert(baseRow(id, U.studentB, SCHOOL_A))
      expect(error).not.toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // UPDATE (requester)
  // -------------------------------------------------------------------------
  describe('club_reg_update_own', () => {
    it('requester can edit their own pending request', async () => {
      const { data, error } = await clientAs(U.studentA)
        .from('club_registration_requests')
        .update({ description: 'Edited description' })
        .eq('id', REQ_A)
        .select('id')
      expect(error, error?.message).toBeNull()
      expect(data?.length).toBe(1)
    })

    it('requester CANNOT self-approve (WITH CHECK blocks status flip)', async () => {
      const { error } = await clientAs(U.studentA)
        .from('club_registration_requests')
        .update({ status: 'approved' })
        .eq('id', REQ_A)
      expect(error).not.toBeNull()

      // Row is untouched.
      const { data } = await admin.from('club_registration_requests').select('status').eq('id', REQ_A).single()
      expect(data?.status).toBe('pending')
    })

    it('requester cannot edit ANOTHER requester\'s request (row filtered out)', async () => {
      const { data } = await clientAs(U.studentA2)
        .from('club_registration_requests')
        .update({ description: 'hijack' })
        .eq('id', REQ_A)
        .select('id')
      expect(data?.length ?? 0).toBe(0)

      const { data: after } = await admin.from('club_registration_requests').select('description').eq('id', REQ_A).single()
      expect(after?.description).not.toBe('hijack')
    })
  })

  // -------------------------------------------------------------------------
  // REVIEW (superadmin)
  // -------------------------------------------------------------------------
  describe('club_reg_review', () => {
    it('superadmin can approve any request', async () => {
      const { data, error } = await clientAs(U.superA)
        .from('club_registration_requests')
        .update({ status: 'approved', reviewer_id: U.superA, reviewed_at: new Date().toISOString() })
        .eq('id', REQ_B)
        .select('id')
      expect(error, error?.message).toBeNull()
      expect(data?.length).toBe(1)
    })
  })
})

describe.skipIf(HAVE_TEST_DB)('0021: club_registration RLS (skipped - no test DB env)', () => {
  it('would test open-registration RLS if SUPABASE_TEST_* were set', () => {
    expect(true).toBe(true)
  })
})
