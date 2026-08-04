import { describe, it, expect } from 'vitest'
import type { OpenSchool } from '@/lib/open-registration'

/**
 * The email gate is the only thing standing between "anyone with a Clerk
 * account" and "enrolled member of a real school", so its selection rule gets
 * covered directly. The DB is stubbed: these assert who is let through, not
 * what is written.
 */

// lib/supabase builds a client at module load, so the module under test can
// only be imported once these exist. Values are never dialled — every DB call
// in this file goes through the stub below.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://stub.invalid'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'stub-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'stub-service-key'
const { enrollStudent, callerEmails } = await import('@/lib/open-registration')

const school: OpenSchool = {
  id: 'school_uconn',
  name: 'University of Connecticut',
  status: 'active',
  open_registration: true,
  allowed_email_domain: 'uconn.edu',
  registration_slug: 'uconn',
}

/** Minimal Supabase stub: caller is a brand-new user, every write succeeds. */
function stubDb(existing: { school_id: string | null; role: string } | null = null) {
  const writes: unknown[] = []
  const db = {
    from() {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing }) }) }),
        update: (v: unknown) => {
          writes.push(v)
          return { eq: async () => ({ error: null }) }
        },
        upsert: async (v: unknown) => {
          writes.push(v)
          return { error: null }
        },
      }
    },
  }
  return { db: db as never, writes }
}

const run = (emails: { email: string; verified: boolean }[]) =>
  enrollStudent({ db: stubDb().db, userId: 'user_1', emails, name: 'Zain', school })

describe('enrollStudent email gate', () => {
  it('accepts a verified school address that is the primary', async () => {
    expect(await run([{ email: 'zack24002@uconn.edu', verified: true }])).toEqual({ ok: true })
  })

  it('accepts a verified school address held as a SECONDARY address', async () => {
    // The regression: primary is a personal Gmail, school address is verified
    // but not primary. The old primary-only check rejected this outright.
    const res = await run([
      { email: 'personal@gmail.com', verified: true },
      { email: 'zack24002@uconn.edu', verified: true },
    ])
    expect(res).toEqual({ ok: true })
  })

  it('stores the school address, not the primary, when they differ', async () => {
    const { db, writes } = stubDb()
    await enrollStudent({
      db,
      userId: 'user_1',
      emails: [
        { email: 'personal@gmail.com', verified: true },
        { email: 'Zack24002@UConn.edu', verified: true },
      ],
      name: 'Zain',
      school,
    })
    expect(writes).toHaveLength(1)
    expect((writes[0] as { email: string }).email).toBe('zack24002@uconn.edu')
  })

  it('rejects an UNVERIFIED school address with a fixable instruction', async () => {
    const res = await run([{ email: 'zack24002@uconn.edu', verified: false }])
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.status).toBe(403)
    expect(res.error).toContain('zack24002@uconn.edu')
    expect(res.error).not.toContain('different account')
  })

  it('rejects an out-of-domain account with the domain message', async () => {
    const res = await run([{ email: 'someone@gmail.com', verified: true }])
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('@uconn.edu')
  })

  it('does NOT accept an unverified school address even alongside a verified personal one', async () => {
    // Anyone can add any address to a Clerk account; only verification proves
    // control. This is the case that would let a non-student self-enrol.
    const res = await run([
      { email: 'personal@gmail.com', verified: true },
      { email: 'notmine@uconn.edu', verified: false },
    ])
    expect(res.ok).toBe(false)
  })

  it('rejects when the school is not active', async () => {
    const res = await enrollStudent({
      db: stubDb().db,
      userId: 'user_1',
      emails: [{ email: 'zack24002@uconn.edu', verified: true }],
      name: 'Zain',
      school: { ...school, status: 'pending' },
    })
    expect(res.ok).toBe(false)
  })
})

describe('callerEmails', () => {
  it('maps every address on the Clerk user, marking only verified ones', () => {
    expect(
      callerEmails({
        emailAddresses: [
          { emailAddress: 'a@gmail.com', verification: { status: 'verified' } },
          { emailAddress: 'b@uconn.edu', verification: { status: 'unverified' } },
          { emailAddress: 'c@uconn.edu', verification: null },
        ],
      }),
    ).toEqual([
      { email: 'a@gmail.com', verified: true },
      { email: 'b@uconn.edu', verified: false },
      { email: 'c@uconn.edu', verified: false },
    ])
  })

  it('treats Clerk "transferable" as NOT verified', () => {
    // `transferable` shows up mid-OAuth-transfer and is not proof of control.
    expect(
      callerEmails({
        emailAddresses: [{ emailAddress: 'x@uconn.edu', verification: { status: 'transferable' } }],
      }),
    ).toEqual([{ email: 'x@uconn.edu', verified: false }])
  })
})
