// ── Admin global controls ──────────────────────────────────────────────────
const ADMIN_KEY = 'clubit_admin_settings'

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

export function getAdminSettings(): AdminSettings {
  if (typeof window === 'undefined') return ADMIN_DEFAULTS
  try {
    const raw = localStorage.getItem(ADMIN_KEY)
    return raw ? { ...ADMIN_DEFAULTS, ...JSON.parse(raw) } : ADMIN_DEFAULTS
  } catch { return ADMIN_DEFAULTS }
}

export function setAdminSettings(partial: Partial<AdminSettings>): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...getAdminSettings(), ...partial }))
}

// ── Per-user privacy settings ──────────────────────────────────────────────
const PRIVACY_PREFIX = 'clubit_privacy_'

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

export function getUserPrivacy(userId: string): UserPrivacySettings {
  if (typeof window === 'undefined') return PRIVACY_DEFAULTS
  try {
    const raw = localStorage.getItem(PRIVACY_PREFIX + userId)
    return raw ? { ...PRIVACY_DEFAULTS, ...JSON.parse(raw) } : PRIVACY_DEFAULTS
  } catch { return PRIVACY_DEFAULTS }
}

export function setUserPrivacy(userId: string, partial: Partial<UserPrivacySettings>): void {
  localStorage.setItem(PRIVACY_PREFIX + userId, JSON.stringify({ ...getUserPrivacy(userId), ...partial }))
}

// ── Per-user app settings ──────────────────────────────────────────────────
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

export function canViewAchievements(viewerId: string, targetId: string, viewerRole: string): boolean {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  const admin = getAdminSettings()
  if (!admin.achievementsFeatureEnabled) return false
  return getUserPrivacy(targetId).achievementsPublic
}

export function canViewAttendance(viewerId: string, targetId: string, viewerRole: string, sharedClubIds: string[]): boolean {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  if (viewerRole === 'advisor' && sharedClubIds.length > 0) return true
  const admin = getAdminSettings()
  if (!admin.attendanceFeatureEnabled) return false
  return getUserPrivacy(targetId).attendancePublic
}

export function canViewClubs(viewerId: string, targetId: string, viewerRole: string): boolean {
  if (viewerRole === 'admin' || viewerId === targetId) return true
  const admin = getAdminSettings()
  if (!admin.clubsFeatureEnabled) return false
  return getUserPrivacy(targetId).clubsPublic
}
