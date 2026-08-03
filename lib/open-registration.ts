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

/**
 * Self-enrol a caller into an open-registration school as a plain `student`,
 * gated solely by a verified primary email in the school's allowed domain.
 * Idempotent: an existing member keeps their stored role (never demoted) and
 * this is a no-op. Does NOT create a club request — enrolment and club
 * submission are separate actions.
 */
export async function enrollStudent(params: {
  db: SupabaseClient
  userId: string
  email: string
  emailVerified: boolean
  name: string
  school: OpenSchool
}): Promise<EnrollResult> {
  const { db, userId, name, school } = params
  const email = params.email.toLowerCase()

  if (school.status !== 'active') {
    return { ok: false, status: 403, error: 'This school is not currently active' }
  }
  if (!params.emailVerified) {
    return { ok: false, status: 403, error: 'Verify your email address with Clerk before continuing.' }
  }
  if (school.allowed_email_domain && !email.endsWith(`@${school.allowed_email_domain.toLowerCase()}`)) {
    return {
      ok: false,
      status: 403,
      error: `Registration is limited to @${school.allowed_email_domain} email addresses.`,
    }
  }

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
