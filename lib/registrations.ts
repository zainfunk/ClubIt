import type { ClubRegistrationRequest, ClubRegistrationStatus, RequesterRole } from '@/types'

/**
 * Shared row shape + mapper for `club_registration_requests`, used by both the
 * public self-serve route (/api/registrations) and the reviewer queue
 * (/api/superadmin/club-registrations). One mapper keeps the JSON the requester
 * sees identical to what the reviewer sees.
 */

export const REGISTRATION_COLUMNS =
  'id, school_id, requester_id, club_name, description, category, expected_members, requester_role, contact_info, status, denial_reason, reviewer_id, reviewed_at, created_club_id, created_at, updated_at'

export interface RegistrationRow {
  id: string
  school_id: string
  requester_id: string
  club_name: string
  description: string
  category: string | null
  expected_members: number | null
  requester_role: string | null
  contact_info: string | null
  status: string
  denial_reason: string | null
  reviewer_id: string | null
  reviewed_at: string | null
  created_club_id: string | null
  created_at: string
  updated_at: string
}

export function mapRegistrationRow(row: RegistrationRow): ClubRegistrationRequest {
  return {
    id: row.id,
    schoolId: row.school_id,
    requesterId: row.requester_id,
    clubName: row.club_name,
    description: row.description,
    category: row.category,
    expectedMembers: row.expected_members,
    requesterRole: (row.requester_role as RequesterRole | null) ?? null,
    contactInfo: row.contact_info,
    status: row.status as ClubRegistrationStatus,
    denialReason: row.denial_reason,
    reviewerId: row.reviewer_id,
    reviewedAt: row.reviewed_at,
    createdClubId: row.created_club_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
