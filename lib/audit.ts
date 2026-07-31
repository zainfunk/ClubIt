/**
 * Server-side audit-log writer.
 *
 * Closes finding W3.3 / assessment §9 item 14. Every admin/security-
 * sensitive write should land an `audit_log` row via this helper. The
 * table is append-only at the SQL level; even service_role cannot
 * UPDATE or DELETE rows after insertion.
 *
 * Use:
 *   import { audit } from '@/lib/audit'
 *   await audit({
 *     action: 'school.role_change',
 *     targetTable: 'users',
 *     targetId: userId,
 *     before: { role: 'student' },
 *     after:  { role: 'admin'   },
 *     actorUserId: callerId,
 *     request,
 *   })
 *
 * Inserts are best-effort: failures are logged but do not abort the
 * caller's transaction. Rationale: the security operation must not be
 * undone by an audit-write hiccup; the operator instead notices the
 * gap when reviewing the log.
 */
import { createServiceClient } from '@/lib/supabase'
import type { NextRequest } from 'next/server'

export type AuditAction =
  // role + identity
  | 'user.role_changed'
  | 'user.override_changed'
  | 'user.privacy_changed'
  | 'user.profile_changed'
  | 'user.password_reset_link_created'
  // school lifecycle
  | 'school.requested'
  | 'school.approved'
  | 'school.rejected'
  | 'school.suspended'
  | 'school.reactivated'
  | 'school.deleted'
  | 'school.codes_rotated'
  | 'school.setup_link_rotated'
  | 'school.settings_changed'
  // invites
  | 'invite.redeemed'
  | 'invite.code_used'
  // staff access requests (admin/advisor elevation gate)
  | 'staff_request.approved'
  | 'staff_request.denied'
  // self-serve club registration (open-registration schools)
  | 'club_registration.approved'
  | 'club_registration.denied'
  // election
  | 'election.created'
  | 'election.opened'
  | 'election.closed'
  | 'election.vote_cast'
  | 'poll.vote_cast'
  // billing
  | 'stripe.webhook_processed'
  | 'stripe.checkout_started'
  | 'stripe.subscription_changed'
  // misc
  | 'issue.resolved'

export interface AuditArgs {
  action: AuditAction
  targetTable?: string
  targetId?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  /**
   * Override the actor. Default: derived from `request` headers if
   * possible, else null. Pass `auth().userId` from the route handler.
   */
  actorUserId?: string | null
  actorRole?: string | null
  request?: NextRequest | Request
}

export async function audit(args: AuditArgs): Promise<void> {
  const db = createServiceClient()

  let ip: string | null = null
  let userAgent: string | null = null
  let requestId: string | null = null
  if (args.request) {
    ip = args.request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
    userAgent = args.request.headers.get('user-agent')?.slice(0, 500) ?? null
    requestId = args.request.headers.get('x-request-id') ?? null
  }

  const { error } = await db.from('audit_log').insert({
    actor_user_id: args.actorUserId ?? null,
    actor_role:    args.actorRole ?? null,
    action:        args.action,
    target_table:  args.targetTable ?? null,
    target_id:     args.targetId ?? null,
    before_jsonb:  args.before ?? null,
    after_jsonb:   args.after ?? null,
    ip,
    user_agent:    userAgent,
    request_id:    requestId,
  })

  if (error) {
    // Don't throw -- audit gaps are visible during review and never
    // worth aborting a successful security operation.
    console.error('[audit] insert failed', { action: args.action, error: error.message })
  }
}

/**
 * Helper: scrub keys from an object before stashing as before/after JSON.
 * Use to redact tokens, secrets, etc.
 */
export function redact<T extends Record<string, unknown>>(obj: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...obj }
  for (const k of keys) {
    if (k in out) out[k] = '***REDACTED***'
  }
  return out as T
}
