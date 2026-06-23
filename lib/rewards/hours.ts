import { supabase } from '@/lib/supabase'

export const DEFAULT_MEETING_MINUTES = 60

// Returns minutes between two "HH:MM" strings. Handles overnight wrap.
function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return DEFAULT_MEETING_MINUTES
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60
  return mins
}

// Compute duration for a check-in by looking up the club's scheduled meeting time
// for the given meeting date's day-of-week. Falls back to the default.
export async function computeMeetingDuration(clubId: string, meetingDate: string): Promise<number> {
  const day = new Date(`${meetingDate}T00:00:00`).getDay()
  if (Number.isNaN(day)) return DEFAULT_MEETING_MINUTES

  const { data } = await supabase
    .from('meeting_times')
    .select('day_of_week, start_time, end_time')
    .eq('club_id', clubId)
    .eq('day_of_week', day)
    .maybeSingle()

  if (!data) return DEFAULT_MEETING_MINUTES
  return minutesBetween(data.start_time as string, data.end_time as string)
}

export interface MemberHours {
  autoMinutes: number
  adjustmentMinutes: number
  totalMinutes: number
}

// Aggregate hours for one (user, club) pair.
export async function computeMemberHours(userId: string, clubId: string): Promise<MemberHours> {
  const [attRes, memRes] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('duration_minutes')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .eq('present', true),
    supabase
      .from('memberships')
      .select('hours_adjustment_minutes')
      .eq('user_id', userId)
      .eq('club_id', clubId)
      .maybeSingle(),
  ])

  const autoMinutes = (attRes.data ?? []).reduce(
    (sum, r) => sum + ((r.duration_minutes as number | null) ?? DEFAULT_MEETING_MINUTES),
    0,
  )
  const adjustmentMinutes = (memRes.data?.hours_adjustment_minutes as number | null) ?? 0

  return {
    autoMinutes,
    adjustmentMinutes,
    totalMinutes: Math.max(0, autoMinutes + adjustmentMinutes),
  }
}

// Aggregate hours across every club the user belongs to. Routed through
// /api/user/hours (service-role) because the browser anon client can't read
// attendance_records / memberships under RLS.
export async function computeUserTotalHours(userId: string): Promise<MemberHours> {
  try {
    const res = await fetch(`/api/user/hours?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    if (!res.ok) return { autoMinutes: 0, adjustmentMinutes: 0, totalMinutes: 0 }
    return (await res.json()) as MemberHours
  } catch {
    return { autoMinutes: 0, adjustmentMinutes: 0, totalMinutes: 0 }
  }
}

export function formatHours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
