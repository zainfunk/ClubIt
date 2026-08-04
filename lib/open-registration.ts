import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'

/**
 * Shared server helpers for the open-registration flow (UConn). Enrolment and
 * club submission both need to resolve the tenant and self-enrol the caller, so
 * the tenant lookup + the email-gated enrolment live here in ONE place — the
 * security-sensitive membership check must not diverge between the enroll-only
 * endpoint and the club-submission POST.
 */

export interface OpenSchool {
  id: string
  name: string
  status: string
  open_registration: boolean
  allowed_email_domain: string | null
  registration_slug: string | null
}

export const OPEN_SCHOOL_COLUMNS =
  'id, name, status, open_registration, allowed_email_domain, registration_slug'

export async function resolveOpenSchool(slug: string): Promise<OpenSchool | null> {
  const db = createServiceClient()
  const { data } = await db
    .from('schools')
    .select(OPEN_SCHOOL_COLUMNS)
    .eq('registration_slug', slug)
    .maybeSingle()

  if (!data || !data.open_registration) return null
  return data as OpenSchool
}

/** The subset of tenant fields safe to expose to an unauthenticated caller. */
export function publicSchool(school: OpenSchool) {
  return {
    name: school.name,
    slug: school.registration_slug,
    allowedEmailDomain: school.allowed_email_domain,
    status: school.status,
  }
}

export type EnrollResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/** One email address on the caller's Clerk account, with its verified state. */
export interface CallerEmail {
  email: string
  verified: boolean
}

/**
 * Flatten a Clerk backend user into the email list the gate below consumes.
 * Both callers MUST build their list through here: reading only
 * `primaryEmailAddress` would reject a student whose school address is a
 * verified *secondary* address on the account (a personal Gmail is very often
 * the primary), so the "which addresses count" rule lives in one place.
 */
export function callerEmails(user: {
  emailAddresses: { emailAddress: string; verification: { status: string } | null }[]
}): CallerEmail[] {
  return user.emailAddresses.map((e) => ({
    email: e.emailAddress,
    verified: e.verification?.status === 'verified',
  }))
}

/**
 * Self-enrol a caller into an open-registration school as a plain `student`,
 * gated on the account holding a *verified* address in the school's allowed
 * domain — any address on the account, not just the primary. Verification is
 * what makes the domain meaningful: an unverified address proves nothing, so
 * accepting one would let anyone claim to be a student there.
 * Idempotent: an existing member keeps their stored role (never demoted) and
 * this is a no-op. Does NOT create a club request — enrolment and club
 * submission are separate actions.
 */
export async function enrollStudent(params: {
  db: SupabaseClient
  userId: string
  emails: CallerEmail[]
  name: string
  school: OpenSchool
}): Promise<EnrollResult> {
  const { db, userId, name, school } = params

  if (school.status !== 'active') {
    return { ok: false, status: 403, error: 'This school is not currently active' }
  }

  const domain = school.allowed_email_domain?.toLowerCase() ?? null
  const emails = params.emails
    .map((e) => ({ email: e.email.toLowerCase().trim(), verified: e.verified }))
    .filter((e) => e.email)
  const inDomain = domain ? emails.filter((e) => e.email.endsWith(`@${domain}`)) : emails

  const qualifying = inDomain.find((e) => e.verified)
  if (!qualifying) {
    // Distinguish "you don't have a school address" from "you have one but
    // never confirmed it" — the second is fixable by the student in seconds,
    // and telling them to switch accounts instead sends them in a circle.
    if (inDomain.length > 0) {
      return {
        ok: false,
        status: 403,
        error: `Confirm ${inDomain[0].email} in your account settings, then reload this page.`,
      }
    }
    return {
      ok: false,
      status: 403,
      error: domain
        ? `Registration is limited to @${domain} email addresses.`
        : 'Confirm your email address before continuing.',
    }
  }
  const email = qualifying.email

  const { data: existingUser } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.role === 'superadmin') {
    return { ok: false, status: 409, error: 'Superadmin accounts cannot self-enrol. Use a separate account.' }
  }
  if (existingUser?.school_id && existingUser.school_id !== school.id) {
    return {
      ok: false,
      status: 409,
      error: 'You are already enrolled in another school. School switching is not supported yet.',
    }
  }

  if (!existingUser?.school_id) {
    const { error: enrolError } = existingUser
      ? await db.from('users').update({ school_id: school.id }).eq('id', userId)
      : await db
          .from('users')
          .upsert(
            { id: userId, name, email, school_id: school.id, role: 'student' },
            { onConflict: 'id' },
          )
    if (enrolError) {
      console.error('open-registration: enrol failed', enrolError)
      return { ok: false, status: 500, error: 'Failed to enrol you into the school. Please try again.' }
    }
  }

  return { ok: true }
}
