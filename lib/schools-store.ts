import { School } from '@/types'

// ── Invite code generation ────────────────────────────────────────────────────

function randomSegment(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0/I/1 to avoid confusion
  let out = ''
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function generateInviteCode(prefix: 'STU' | 'ADM' | 'ADV'): string {
  return `${randomSegment(4)}-${prefix}-${randomSegment(4)}`
}

export function generateSetupToken(): string {
  return `${randomSegment(6)}-${randomSegment(6)}-${randomSegment(6)}`
}

// Setup tokens expire after 7 days
export function setupTokenExpiresAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString()
}

// ── Row mappers ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToSchool(row: Record<string, any>): School {
  return {
    id: row.id,
    name: row.name,
    district: row.district ?? undefined,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    status: row.status,
    studentInviteCode: row.student_invite_code ?? undefined,
    adminInviteCode: row.admin_invite_code ?? undefined,
    advisorInviteCode: row.advisor_invite_code ?? undefined,
    setupToken: row.setup_token ?? undefined,
    setupTokenExpiresAt: row.setup_token_expires_at ?? undefined,
    setupCompletedAt: row.setup_completed_at ?? undefined,
    createdAt: row.created_at,
  }
}
