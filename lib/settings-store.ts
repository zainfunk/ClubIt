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

// Sync read from localStorage cache (used for immediate render, no flicker)
export function getAdminSettings(): AdminSettings {
  if (typeof window === 'undefined') return ADMIN_DEFAULTS
  try {
    const raw = localStorage.getItem(ADMIN_KEY)
    return raw ? { ...ADMIN_DEFAULTS, ...JSON.parse(raw) } : ADMIN_DEFAULTS
  } catch { return ADMIN_DEFAULTS }
}

// Write to localStorage cache only (used internally + as optimistic update)
export function setAdminSettings(partial: Partial<AdminSettings>): void {
  localStorage.setItem(ADMIN_KEY, JSON.stringify({ ...getAdminSettings(), ...partial }))
}

// Fetch from Supabase via API, hydrate localStorage cache
export async function fetchAdminSettings(): Promise<AdminSettings> {
  try {
    const res = await fetch('/api/school/settings', { cache: 'no-store' })
    if (!res.ok) return getAdminSettings()
    const data = await res.json() as AdminSettings
    setAdminSettings(data)
    return data
  } catch {
    return getAdminSettings()
  }
}

// Persist to Supabase via API, also update localStorage cache
export async function persistAdminSettings(partial: Partial<AdminSettings>): Promise<void> {
  setAdminSettings(partial) // optimistic local update
  try {
    await fetch('/api/school/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
  } catch (err) {
    console.error('Failed to persist admin settings', err)
  }
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

// Sync read from localStorage cache
export function getUserPrivacy(userId: string): UserPrivacySettings {
  if (typeof window === 'undefined') return PRIVACY_DEFAULTS
  try {
    const raw = localStorage.getItem(PRIVACY_PREFIX + userId)
    return raw ? { ...PRIVACY_DEFAULTS, ...JSON.parse(raw) } : PRIVACY_DEFAULTS
  } catch { return PRIVACY_DEFAULTS }
}

// Write to localStorage cache only
export function setUserPrivacy(userId: string, partial: Partial<UserPrivacySettings>): void {
  localStorage.setItem(PRIVACY_PREFIX + userId, JSON.stringify({ ...getUserPrivacy(userId), ...partial }))
}

// Fetch from Supabase via API, hydrate localStorage cache
export async function fetchUserPrivacy(userId: string): Promise<UserPrivacySettings> {
  try {
    const res = await fetch('/api/user/privacy', { cache: 'no-store' })
    if (!res.ok) return getUserPrivacy(userId)
    const data = await res.json() as UserPrivacySettings
    setUserPrivacy(userId, data)
    return data
  } catch {
    return getUserPrivacy(userId)
  }
}

// Persist to Supabase via API, also update localStorage cache
export async function persistUserPrivacy(userId: string, partial: Partial<UserPrivacySettings>): Promise<void> {
  setUserPrivacy(userId, partial) // optimistic local update
  try {
    await fetch('/api/user/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
  } catch (err) {
    console.error('Failed to persist user privacy settings', err)
  }
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
