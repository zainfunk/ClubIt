import { supabase } from '@/lib/supabase'

// ── Admin global controls ──────────────────────────────────────────────────

export interface AdminSettings {
  achievementsFeatureEnabled: boolean
  attendanceFeatureEnabled: boolean
  clubsFeatureEnabled: boolean
  studentSocialsEnabled: boolean
}

const ADMIN_DEFAULTS: AdminSettings = {
  achievementsFeatureEnabled: true,
  attendanceFeatureEnabled: true,
  clubsFeatureEnabled: true,
  studentSocialsEnabled: true,
}

export async function getAdminSettings(): Promise<AdminSettings> {
  const { data } = await supabase.from('admin_settings').select('*').eq('id', 1).maybeSingle()
  if (!data) return { ...ADMIN_DEFAULTS }
  return {
    achievementsFeatureEnabled: data.achievements_enabled,
    attendanceFeatureEnabled: data.attendance_enabled,
    clubsFeatureEnabled: data.clubs_enabled,
    studentSocialsEnabled: data.student_socials_enabled,
  }
}

export async function setAdminSettings(partial: Partial<AdminSettings>): Promise<void> {
  await supabase.from('admin_settings').upsert({
    id: 1,
    ...(partial.achievementsFeatureEnabled !== undefined && { achievements_enabled: partial.achievementsFeatureEnabled }),
    ...(partial.attendanceFeatureEnabled !== undefined && { attendance_enabled: partial.attendanceFeatureEnabled }),
    ...(partial.clubsFeatureEnabled !== undefined && { clubs_enabled: partial.clubsFeatureEnabled }),
    ...(partial.studentSocialsEnabled !== undefined && { student_socials_enabled: partial.studentSocialsEnabled }),
  }, { onConflict: 'id' })
}

// ── Per-user privacy settings ──────────────────────────────────────────────

export interface UserPrivacySettings {
  achievementsPublic: boolean
  attendancePublic: boolean
  clubsPublic: boolean
}

const PRIVACY_DEFAULTS: UserPrivacySettings = {
  achievementsPublic: true,
  attendancePublic: false,
  clubsPublic: true,
}

export async function getUserPrivacy(userId: string): Promise<UserPrivacySettings> {
  const { data } = await supabase
    .from('user_privacy_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return { ...PRIVACY_DEFAULTS }
  return {
    achievementsPublic: data.achievements_public,
    attendancePublic: data.attendance_public,
    clubsPublic: data.clubs_public,
  }
}

export async function setUserPrivacy(userId: string, partial: Partial<UserPrivacySettings>): Promise<void> {
  const current = await getUserPrivacy(userId)
  await supabase.from('user_privacy_settings').upsert({
    user_id: userId,
    achievements_public: partial.achievementsPublic ?? current.achievementsPublic,
    attendance_public: partial.attendancePublic ?? current.attendancePublic,
    clubs_public: partial.clubsPublic ?? current.clubsPublic,
  }, { onConflict: 'user_id' })
}

// ── Per-user app settings (dark mode etc.) — keep in localStorage, no DB needed ──

const APP_PREFIX = 'clubit_app_'
export interface UserAppSettings { darkMode: boolean }
const APP_DEFAULTS: UserAppSettings = { darkMode: false }

export function getAppSettings(userId: string): UserAppSettings {
  if (typeof window === 'undefined') return APP_DEFAULTS
  try {
    const raw = localStorage.getItem(APP_PREFIX + userId)
    return raw ? { ...APP_DEFAULTS, ...JSON.parse(raw) } : APP_DEFAULTS
  } catch { return APP_DEFAULTS }
}

export function setAppSettings(userId: string, partial: Partial<UserAppSettings>): void {
  localStorage.setItem(APP_PREFIX + userId, JSON.stringify({ ...getAppSettings(userId), ...partial }))
}

// ── Visibility helpers ─────────────────────────────────────────────────────

export async function canViewAchievements(viewerId: string, targetId: string, viewerRole: string): Promise<boolean> {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  const [admin, privacy] = await Promise.all([getAdminSettings(), getUserPrivacy(targetId)])
  if (!admin.achievementsFeatureEnabled) return false
  return privacy.achievementsPublic
}

export async function canViewAttendance(viewerId: string, targetId: string, viewerRole: string, sharedClubIds: string[]): Promise<boolean> {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  if (viewerRole === 'advisor' && sharedClubIds.length > 0) return true
  const [admin, privacy] = await Promise.all([getAdminSettings(), getUserPrivacy(targetId)])
  if (!admin.attendanceFeatureEnabled) return false
  return privacy.attendancePublic
}

export async function canViewClubs(viewerId: string, targetId: string, viewerRole: string): Promise<boolean> {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  const [admin, privacy] = await Promise.all([getAdminSettings(), getUserPrivacy(targetId)])
  if (!admin.clubsFeatureEnabled) return false
  return privacy.clubsPublic
}
