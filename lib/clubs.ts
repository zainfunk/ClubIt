import { createServiceClient } from '@/lib/supabase'
import type { Club } from '@/types'

/**
 * Shared club creation, used by BOTH the normal admin/advisor path
 * (POST /api/school/clubs) and the open-registration approval path
 * (POST /api/superadmin/club-registrations). Keeping a single insert here is
 * what makes an approved self-serve club indistinguishable from any other:
 * same columns, same id shape, same defaults.
 *
 * Callers own their own authorization. This helper only writes the row.
 */

export const CLUB_COLUMNS =
  'id, name, description, icon_url, capacity, advisor_id, auto_accept, tags, event_creator_ids, dues_amount_cents, created_at'

export interface ClubRow {
  id: string
  name: string
  description: string | null
  icon_url: string | null
  capacity: number | null
  advisor_id: string | null
  auto_accept: boolean | null
  tags: string[] | null
  event_creator_ids: string[] | null
  dues_amount_cents: number | null
  created_at: string
}

export function mapClubRowToClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    iconUrl: row.icon_url ?? undefined,
    capacity: row.capacity,
    advisorId: row.advisor_id ?? '',
    memberIds: [],
    leadershipPositions: [],
    socialLinks: [],
    meetingTimes: [],
    tags: row.tags ?? [],
    eventCreatorIds: row.event_creator_ids ?? [],
    createdAt: row.created_at,
    autoAccept: row.auto_accept ?? false,
    duesAmountCents: row.dues_amount_cents ?? 0,
  }
}

export interface CreateClubInput {
  schoolId: string
  name: string
  description: string
  /** Becomes clubs.advisor_id — the club owner/manager. */
  ownerId: string
  iconUrl?: string | null
  capacity?: number | null
  tags?: string[]
}

export type CreateClubResult =
  | { ok: true; club: Club }
  | { ok: false; error: string }

export async function createClub(
  input: CreateClubInput,
  db = createServiceClient(),
): Promise<CreateClubResult> {
  const createdAt = new Date().toISOString().split('T')[0]
  const clubId = `club-${crypto.randomUUID()}`

  const { data, error } = await db
    .from('clubs')
    .insert({
      id: clubId,
      name: input.name,
      description: input.description,
      icon_url: input.iconUrl || null,
      capacity: input.capacity ?? null,
      advisor_id: input.ownerId,
      auto_accept: false,
      tags: input.tags ?? [],
      event_creator_ids: [],
      created_at: createdAt,
      school_id: input.schoolId,
    })
    .select(CLUB_COLUMNS)
    .single()

  if (error || !data) {
    console.error('createClub: insert failed', error)
    return { ok: false, error: error?.message ?? 'Failed to create club' }
  }

  return { ok: true, club: mapClubRowToClub(data as ClubRow) }
}
