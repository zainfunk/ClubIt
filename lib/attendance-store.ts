import { AttendanceSession, AttendanceRecord } from '@/types'
import { supabase } from '@/lib/supabase'

// --- Sessions ---

export async function getAllSessions(): Promise<AttendanceSession[]> {
  const { data } = await supabase.from('attendance_sessions').select('*')
  return (data ?? []).map(mapSession)
}

export async function getSessionsByClub(clubId: string): Promise<AttendanceSession[]> {
  const { data } = await supabase.from('attendance_sessions').select('*').eq('club_id', clubId)
  return (data ?? []).map(mapSession)
}

export async function getSessionById(id: string): Promise<AttendanceSession | undefined> {
  const { data } = await supabase.from('attendance_sessions').select('*').eq('id', id).maybeSingle()
  return data ? mapSession(data) : undefined
}

export async function saveSession(session: AttendanceSession): Promise<void> {
  await supabase.from('attendance_sessions').upsert({
    id: session.id,
    club_id: session.clubId,
    meeting_date: session.meetingDate,
    created_by: session.createdBy,
    expires_at: session.expiresAt,
    max_distance_meters: session.maxDistanceMeters,
    advisor_lat: session.advisorLat,
    advisor_lng: session.advisorLng,
    recorded_user_ids: session.recordedUserIds,
  })
}

export async function markSessionCheckin(sessionId: string, userId: string): Promise<void> {
  const session = await getSessionById(sessionId)
  if (!session || session.recordedUserIds.includes(userId)) return
  await supabase
    .from('attendance_sessions')
    .update({ recorded_user_ids: [...session.recordedUserIds, userId] })
    .eq('id', sessionId)
}

// --- Records ---

export async function getRecordsByClub(clubId: string): Promise<AttendanceRecord[]> {
  const { data } = await supabase.from('attendance_records').select('*').eq('club_id', clubId)
  return (data ?? []).map(mapRecord)
}

export async function upsertRecord(
  clubId: string, userId: string, meetingDate: string, present: boolean
): Promise<string> {
  const id = `att-dyn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const { data } = await supabase
    .from('attendance_records')
    .upsert({ id, club_id: clubId, user_id: userId, meeting_date: meetingDate, present },
             { onConflict: 'club_id,user_id,meeting_date' })
    .select('id')
    .maybeSingle()
  return data?.id ?? id
}

// --- Mappers ---

function mapSession(r: Record<string, unknown>): AttendanceSession {
  return {
    id: r.id as string,
    clubId: r.club_id as string,
    meetingDate: r.meeting_date as string,
    createdBy: r.created_by as string,
    expiresAt: r.expires_at as string,
    maxDistanceMeters: r.max_distance_meters as number,
    advisorLat: r.advisor_lat as number | undefined,
    advisorLng: r.advisor_lng as number | undefined,
    recordedUserIds: r.recorded_user_ids as string[],
  }
}

function mapRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: r.id as string,
    clubId: r.club_id as string,
    userId: r.user_id as string,
    meetingDate: r.meeting_date as string,
    present: r.present as boolean,
  }
}

// Haversine distance in metres
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
