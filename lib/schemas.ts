/**
 * Zod schemas for API request bodies.
 *
 * Closes finding W3.4 / H-10 from ClubIt-Security-Assessment.md.
 *
 * Every API route handler should:
 *
 *   const parsed = SomeSchema.safeParse(await request.json())
 *   if (!parsed.success) {
 *     return NextResponse.json(
 *       { error: 'Invalid request', issues: parsed.error.issues },
 *       { status: 400 },
 *     )
 *   }
 *   // use parsed.data, which is fully typed and validated.
 *
 * The point is not just type safety -- zod refuses unknown extra fields
 * by default in `.strict()` schemas, which closes mass-assignment bugs
 * (a client cannot smuggle role/school_id/created_at into a profile
 * update).
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Reusable atoms
// ---------------------------------------------------------------------------

/** http/https only URL. Rejects javascript:, data:, vbscript:, etc. */
export const SafeUrl = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (v) => {
      try {
        const u = new URL(v)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'URL must use http or https protocol' },
  )

/** Trimmed non-empty string with a max length. */
export const ShortText = (max = 200) => z.string().trim().min(1).max(max)

/** Optional trimmed string up to max chars; empty string -> null. */
export const OptionalText = (max = 200) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null))

// ---------------------------------------------------------------------------
// /api/onboard
// ---------------------------------------------------------------------------

export const OnboardSchema = z
  .object({
    name: ShortText(200),
    district: z.string().trim().max(200).optional(),
    contactName: ShortText(120),
    contactEmail: z.string().trim().email().max(254),
  })
  .strict()

// ---------------------------------------------------------------------------
// /api/join
// ---------------------------------------------------------------------------

export const JoinSchema = z
  .object({
    code: z.string().trim().min(1).max(64),
  })
  .strict()

// ---------------------------------------------------------------------------
// /api/user/profile -- the H-10 fix lives here.
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORMS = [
  'instagram', 'twitter', 'discord', 'facebook', 'youtube', 'website', 'other',
] as const

export const SocialLinkSchema = z
  .object({
    id: z.string().trim().max(64).optional(),
    platform: z.enum(SOCIAL_PLATFORMS),
    url: SafeUrl, // <-- core of H-10 mitigation
    label: z.string().trim().max(80).optional(),
  })
  .strict()

export const ProfilePatchSchema = z
  .object({
    bio:       z.string().max(4000).optional(),
    skills:    z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    interests: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    socials:   z.array(SocialLinkSchema).max(20).optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// /api/user/overrides
// ---------------------------------------------------------------------------

export const UserOverridesSchema = z
  .object({
    name:  z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(254).optional(),
  })
  .strict()
  .refine((v) => v.name || v.email, { message: 'At least one of name or email is required' })

// ---------------------------------------------------------------------------
// /api/user/privacy
// ---------------------------------------------------------------------------

export const PrivacyPatchSchema = z
  .object({
    achievementsPublic: z.boolean().optional(),
    attendancePublic:   z.boolean().optional(),
    clubsPublic:        z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field required' })

// ---------------------------------------------------------------------------
// /api/checkout, /api/stripe/checkout
// ---------------------------------------------------------------------------

export const CheckoutSchema = z
  .object({
    plan: z.enum(['monthly', 'yearly']).optional(),
  })
  .strict()
  .optional() // /api/checkout takes no body today

// ---------------------------------------------------------------------------
// /api/school/elections (POST -- create)
// ---------------------------------------------------------------------------

export const CreateElectionSchema = z
  .object({
    positionTitle: ShortText(120),
    description:   z.string().trim().max(2000).optional(),
    candidateUserIds: z.array(z.string().trim().min(1).max(120)).min(2).max(50),
  })
  .strict()

// ---------------------------------------------------------------------------
// /api/registrations -- self-serve club registration (open-registration schools)
// ---------------------------------------------------------------------------

export const REQUESTER_ROLES = ['president', 'officer'] as const

/** Fields a requester submits or edits. Shared by POST (create) and PATCH. */
export const ClubRegistrationSchema = z
  .object({
    clubName:        ShortText(120),
    description:     z.string().trim().min(1).max(2000),
    category:        z.string().trim().max(80).optional().or(z.literal('')),
    expectedMembers: z.number().int().min(1).max(100_000).optional(),
    requesterRole:   z.enum(REQUESTER_ROLES),
    contactInfo:     z.string().trim().max(200).optional().or(z.literal('')),
    slug:            z.string().trim().min(1).max(60),
  })
  .strict()

/** Reviewer approve/deny. Deny requires a non-empty reason. */
export const ClubRegistrationReviewSchema = z
  .object({
    id:     z.string().trim().min(1).max(80),
    action: z.enum(['approve', 'deny']),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => v.action !== 'deny' || (v.reason && v.reason.length > 0), {
    message: 'A reason is required when denying a request',
    path: ['reason'],
  })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard 400 response shape for failed parses. */
export function badRequest(issues: unknown) {
  return { error: 'Invalid request', issues } as const
}
