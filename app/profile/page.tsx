'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchClubsByIds, fetchSchoolClubs, fetchSchoolUsers } from '@/lib/school-data'
import { supabase } from '@/lib/supabase'
import { setName, setEmail } from '@/lib/user-store'
import { getProfile, setProfile, SOCIAL_PLATFORMS, PersonalSocialLink } from '@/lib/profile-store'
import { getAdminSettings } from '@/lib/settings-store'
import { getRecordsByClub } from '@/lib/attendance-store'
import { AttendanceRecord, Club, User } from '@/types'
import Avatar from '@/components/Avatar'
import { Input } from '@/components/ui/input'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import RewardsSummary from '@/components/profile/RewardsSummary'
import BadgeGrid from '@/components/profile/BadgeGrid'
import { computeUserTotalHours, formatHours, MemberHours } from '@/lib/rewards/hours'
import {
  Pencil, Check, X, Plus, Trash2,
  ExternalLink, EyeOff, Users, Mail, BadgeCheck,
  Star, Flame, BookOpen, Award, Clock, AlertCircle,
  Camera, Loader2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-50 text-red-600 border-red-100',
  advisor: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  student: 'bg-emerald-50 text-emerald-600 border-emerald-100',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', advisor: 'Faculty Advisor', student: 'Student Member',
}

type Tab = 'overview' | 'clubs' | 'attendance' | 'achievements'

export default function ProfilePage() {
  const { currentUser } = useMockAuth()
  const profileUser = currentUser
  const canEdit = true

  const [profile, setProfileState] = useState({ bio: '', skills: [] as string[], interests: [] as string[], socials: [] as PersonalSocialLink[] })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [schoolUsers, setSchoolUsers] = useState<User[]>([])

  useEffect(() => {
    if (!currentUser.schoolId) return
    fetchSchoolUsers(currentUser.schoolId).then(setSchoolUsers)
  }, [currentUser.schoolId])

  // ---- Avatar (profile picture) ----
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!currentUser.id) return
    supabase.from('users').select('avatar_url').eq('id', currentUser.id).maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null))
  }, [currentUser.id])

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setProfileError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/user/avatar', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) setAvatarUrl(data.avatarUrl)
      else setProfileError(data.error ?? 'Failed to upload image')
    } catch {
      setProfileError('Failed to upload image')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true)
    try {
      const res = await fetch('/api/user/avatar', { method: 'DELETE' })
      if (res.ok) setAvatarUrl(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  useEffect(() => {
    setProfileLoading(true)
    setProfileError(null)
    getProfile(profileUser.id)
      .then(setProfileState)
      .catch((err) => {
        setProfileError(err instanceof Error ? err.message : 'Failed to load profile')
      })
      .finally(() => setProfileLoading(false))
  }, [profileUser.id])

  async function saveProfile(partial: Parameters<typeof setProfile>[1]) {
    await setProfile(profileUser.id, partial)
    getProfile(profileUser.id).then(setProfileState)
  }

  // ---- Name editing ----
  const [nameInput, setNameInput] = useState('')
  useEffect(() => {
    Promise.resolve().then(() => setNameInput(profileUser.name))
  }, [profileUser.name])
  function saveName() {
    if (!nameInput.trim() || nameInput.trim() === profileUser.name) return
    void setName(profileUser.id, nameInput.trim())
  }

  // ---- Email editing ----
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  function saveEmail() {
    if (!emailInput.trim()) return
    void setEmail(profileUser.id, emailInput.trim())
    setEditingEmail(false)
  }

  // ---- Bio editing ----
  const [bioInput, setBioInput] = useState('')
  useEffect(() => { getProfile(profileUser.id).then((p) => setBioInput(p.bio)) }, [profileUser.id])
  function saveBio() {
    if (bioInput !== profile.bio) saveProfile({ bio: bioInput })
  }

  // ---- Socials editing ----
  const [editingSocials, setEditingSocials] = useState(false)
  const [socialsInput, setSocialsInput] = useState<PersonalSocialLink[]>([])
  const [newSocialLabel, setNewSocialLabel] = useState(SOCIAL_PLATFORMS[0])
  const [newSocialUrl, setNewSocialUrl] = useState('')

  function startEditSocials() { setSocialsInput(profile.socials.map((s) => ({ ...s }))); setEditingSocials(true) }
  function saveSocials() { saveProfile({ socials: socialsInput.filter((s) => s.url.trim()) }); setEditingSocials(false) }
  function addSocial() {
    if (!newSocialUrl.trim()) return
    setSocialsInput((prev) => [...prev, { id: `social-${Date.now()}`, label: newSocialLabel, url: newSocialUrl.trim() }])
    setNewSocialUrl('')
  }

  // ---- Clubs & attendance ----
  const [memberClubs, setMemberClubs] = useState<Club[]>([])
  const [advisingClubs, setAdvisingClubs] = useState<Club[]>([])
  useEffect(() => {
    if (!profileUser.id || !currentUser.schoolId) return
    supabase.from('memberships').select('club_id').eq('user_id', profileUser.id).then(({ data }) => {
      const ids = (data ?? []).map((r) => r.club_id)
      if (ids.length > 0) {
        fetchClubsByIds(ids).then(setMemberClubs)
      } else {
        setMemberClubs([])
      }
    })
    if (profileUser.role === 'advisor' || profileUser.role === 'admin') {
      fetchSchoolClubs(currentUser.schoolId).then((clubs) => {
        setAdvisingClubs(clubs.filter((club) => club.advisorId === profileUser.id))
      })
    } else {
      Promise.resolve().then(() => setAdvisingClubs([]))
    }
  }, [currentUser.schoolId, profileUser.id, profileUser.role])

  const displayClubs = profileUser.role === 'advisor' ? advisingClubs : memberClubs
  const usersById = Object.fromEntries(schoolUsers.map((user) => [user.id, user]))

  function resolveUser(userId: string) {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : undefined)
  }

  const [supabaseAttendance, setSupabaseAttendance] = useState<AttendanceRecord[]>([])
  useEffect(() => {
    Promise.all(memberClubs.map((c) => getRecordsByClub(c.id))).then((results) => {
      setSupabaseAttendance(results.flat().filter((r) => r.userId === profileUser.id))
    })
  }, [profileUser.id, memberClubs])

  function getClubAttendance(clubId: string): AttendanceRecord[] {
    return supabaseAttendance
      .filter((r) => r.clubId === clubId)
      .sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
  }

  const allAttendanceRecords = memberClubs.flatMap((c) => getClubAttendance(c.id))

  const totalMeetings = allAttendanceRecords.length
  const presentCount = allAttendanceRecords.filter((r) => r.present).length
  const attendancePct = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0

  const memberClubIds = memberClubs.map((c) => c.id)

  // Total hours (auto + advisor adjustment) across every club the user belongs to.
  const [totalHours, setTotalHours] = useState<MemberHours>({ autoMinutes: 0, adjustmentMinutes: 0, totalMinutes: 0 })
  useEffect(() => {
    if (!profileUser.id) return
    void computeUserTotalHours(profileUser.id).then(setTotalHours)
  }, [profileUser.id, supabaseAttendance.length, memberClubs.length])

  // Earned badge count for the stats row
  const [earnedCount, setEarnedCount] = useState(0)
  useEffect(() => {
    if (!profileUser.id) return
    supabase.from('user_badges').select('badge_key', { count: 'exact', head: true }).eq('user_id', profileUser.id).then(({ count }) => {
      setEarnedCount(count ?? 0)
    })
  }, [profileUser.id])

  const adminSettings = getAdminSettings()

  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'clubs', label: profileUser.role === 'advisor' ? 'Clubs Advised' : 'My Clubs' },
    ...(profileUser.role === 'student' ? [{ key: 'attendance' as Tab, label: 'Attendance' }] : []),
    { key: 'achievements', label: 'Achievements' },
  ]

  if (!currentUser.id) return null

  if (profileLoading) return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white border border-slate-200/60 p-8" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
        <div className="flex items-center gap-6">
          <Skeleton className="w-24 h-24 rounded-2xl" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-white border border-slate-200/60 p-5" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
            <Skeleton className="h-8 w-12 mb-2" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  )

  const roleGradient: Record<string, string> = {
    admin:   'from-red-500 via-rose-500 to-orange-400',
    advisor: 'from-indigo-500 via-indigo-600 to-emerald-500',
    student: 'from-emerald-500 via-teal-500 to-cyan-400',
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'var(--font-inter)' }}>

      {/* Error banner */}
      {profileError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load profile</p>
            <p className="text-xs text-red-600 mt-0.5">{profileError}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Hero ── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/60" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
        {/* Gradient banner */}
        <div className={`h-20 bg-gradient-to-r ${roleGradient[profileUser.role]} relative`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_70%)]" />
        </div>

        <div className="px-5 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Avatar + upload control */}
            <div className="relative shrink-0 mx-auto sm:mx-0">
              <div className="rounded-2xl p-1 bg-white shadow-lg shadow-slate-900/10">
                <Avatar name={profileUser.name} imageUrl={avatarUrl} size="lg" className="!w-20 !h-20 !text-2xl !rounded-xl" />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg ring-2 ring-white hover:bg-slate-700 transition-colors disabled:opacity-60"
                title="Change profile picture"
              >
                {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onAvatarPick} />
            </div>

            {/* Name / role / email */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                {canEdit ? (
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={(e) => e.key === 'Enter' && saveName()}
                    className="h-auto text-2xl sm:text-3xl font-extrabold tracking-tight max-w-xs sm:max-w-md border-none shadow-none px-0 py-0 focus-visible:ring-0 text-center sm:text-left"
                    style={{ fontFamily: 'var(--font-manrope)' }}
                  />
                ) : (
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 truncate"
                    style={{ fontFamily: 'var(--font-manrope)' }}>
                    {profileUser.name}
                  </h1>
                )}
                <BadgeCheck className="w-6 h-6 text-indigo-500 shrink-0" />
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap mt-1.5">
                <span className={`text-xs font-semibold px-3 py-0.5 rounded-full border ${ROLE_BADGE[profileUser.role]}`}>
                  {ROLE_LABEL[profileUser.role]}
                </span>
                {editingEmail ? (
                  <span className="inline-flex items-center gap-2">
                    <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                      className="h-7 text-sm max-w-[14rem]" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                    <button onClick={saveEmail} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingEmail(false)} className="text-slate-400"><X className="w-4 h-4" /></button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-sm text-slate-500 truncate">{profileUser.email}</span>
                    {canEdit && (
                      <button onClick={() => { setEmailInput(profileUser.email); setEditingEmail(true) }}
                        className="text-slate-400 hover:text-slate-600 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                )}
                {avatarUrl && (
                  <button onClick={removeAvatar} disabled={uploadingAvatar}
                    className="text-xs font-medium text-slate-400 hover:text-red-500 transition-colors">
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {/* Message */}
            <a href={`mailto:${profileUser.email}`}
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 self-start">
              <Mail className="w-4 h-4" />
              Message
            </a>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: displayClubs.length, label: 'Clubs', icon: <Users className="w-4 h-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          ...(profileUser.role === 'student' ? [
            ...(adminSettings.hoursTrackingEnabled
              ? [{ value: formatHours(totalHours.totalMinutes), label: 'Total hours', icon: <Clock className="w-4 h-4" />, color: 'text-cyan-600', bg: 'bg-cyan-50' }]
              : [{ value: `${attendancePct}%`, label: 'Attendance', icon: <Flame className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' }]),
            ...(adminSettings.achievementsFeatureEnabled
              ? [{ value: earnedCount, label: 'Badges', icon: <Award className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50' }]
              : []),
          ] : []),
          { value: memberClubs.filter((c) => c.leadershipPositions.some((lp) => lp.userId === profileUser.id)).length, label: 'Leadership', icon: <Star className="w-4 h-4" />, color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map(({ value, label, icon, color, bg }) => (
          <div key={label} className="rounded-2xl bg-white border border-slate-200/60 p-5 flex items-center gap-4"
            style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
            <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0`}>
              {icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>{value}</p>
              <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left sidebar — Bio & Socials */}
        <div className="space-y-5">
          {/* Bio */}
          <div className="rounded-2xl bg-white border border-slate-200/60 p-6" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">About</h3>
            {canEdit ? (
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                onBlur={saveBio}
                rows={4}
                placeholder="Write a short bio..."
                className="w-full text-sm text-slate-700 rounded-xl px-4 py-3 bg-slate-50 border border-slate-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none transition-all"
              />
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed">
                {profile.bio || <span className="text-slate-400 italic">No bio yet.</span>}
              </p>
            )}
          </div>

          {/* Socials */}
          {(currentUser.role === 'admin' || profileUser.role !== 'student' || getAdminSettings().studentSocialsEnabled) && (
          <div className="rounded-2xl bg-white border border-slate-200/60 p-6" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Links</h3>
              {canEdit && !editingSocials && (
                <button onClick={startEditSocials} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {editingSocials ? (
              <div className="space-y-2.5">
                {socialsInput.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <select value={s.label}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="text-xs rounded-lg px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 w-28">
                      {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <Input value={s.url}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://..." className="h-7 text-xs flex-1" />
                    <button onClick={() => setSocialsInput((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <select value={newSocialLabel} onChange={(e) => setNewSocialLabel(e.target.value)}
                    className="text-xs rounded-lg px-2.5 py-1.5 bg-slate-50 border border-slate-200/60 w-28">
                    {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                    placeholder="https://..." className="h-7 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addSocial()} />
                  <button onClick={addSocial} className="text-indigo-500 hover:text-indigo-700 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={saveSocials} className="text-xs font-semibold text-emerald-600 hover:underline">Save</button>
                  <button onClick={() => setEditingSocials(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.socials.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No links added yet.</p>
                ) : (
                  profile.socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-slate-600 bg-slate-50 border border-slate-200/60 hover:bg-slate-100 hover:border-slate-300 transition-all">
                      <ExternalLink className="w-3 h-3" />
                      {s.label}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
          )}

          {/* Rewards summary (students only) — gated by admin settings inside the component */}
          {profileUser.role === 'student' && (
            <RewardsSummary userId={profileUser.id} clubIds={memberClubIds} />
          )}

          {/* Activity Snapshot (students only, sidebar) */}
          {profileUser.role === 'student' && (
            <div className="rounded-2xl bg-white border border-slate-200/60 p-6" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Activity Snapshot</h3>
              <div className="space-y-3">
                {[
                  {
                    label: 'Engagement',
                    value: attendancePct >= 80 ? 'High' : attendancePct >= 50 ? 'Medium' : 'Low',
                    color: attendancePct >= 80 ? 'text-emerald-600' : attendancePct >= 50 ? 'text-amber-600' : 'text-red-500',
                  },
                  {
                    label: 'Standing',
                    value: earnedCount >= 4 ? 'Elite' : earnedCount >= 2 ? 'Active' : 'New',
                    color: earnedCount >= 4 ? 'text-indigo-600' : earnedCount >= 2 ? 'text-amber-600' : 'text-slate-500',
                  },
                  {
                    label: 'Meetings',
                    value: `${presentCount} / ${totalMeetings}`,
                    color: 'text-slate-900',
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className={`text-sm font-bold ${color}`} style={{ fontFamily: 'var(--font-manrope)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right content — Tabs */}
        <div className="lg:col-span-2">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-6">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  tab === t.key
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-4">
              {displayClubs.length > 0 && (
                <div className="rounded-2xl bg-white border border-slate-200/60 p-6" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                    Active Memberships
                  </h3>
                  <div className="space-y-2">
                    {displayClubs.map((club) => {
                      const advisor = resolveUser(club.advisorId)
                      const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
                      return (
                        <Link key={club.id} href={`/clubs/${club.id}`}>
                          <div className="flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all hover:bg-slate-50 border border-transparent hover:border-slate-200/60">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-lg shrink-0">
                              {club.iconUrl ?? '📌'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-900 text-sm leading-tight"
                                style={{ fontFamily: 'var(--font-manrope)' }}>
                                {club.name}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Advisor: {advisor?.name ?? '—'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {position && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                  {position.title}
                                </span>
                              )}
                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Users className="w-3.5 h-3.5" />
                                {club.memberIds.length}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {displayClubs.length === 0 && (
                <div className="rounded-2xl bg-white border border-slate-200/60 p-12 text-center" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">No clubs yet</p>
                  <p className="text-xs text-slate-400 mt-1">Join a club to see your activity here.</p>
                  <Link href="/clubs" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 mt-3 transition-colors">
                    Browse clubs
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: My Clubs ── */}
          {tab === 'clubs' && (
            <div className="space-y-3">
              {displayClubs.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200/60 p-12 text-center" style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                  <p className="text-sm text-slate-500 italic">
                    {profileUser.role === 'advisor' ? 'Not advising any clubs.' : 'Not a member of any clubs yet.'}
                  </p>
                </div>
              ) : (
                displayClubs.map((club) => {
                  const advisor = resolveUser(club.advisorId)
                  const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
                  return (
                    <Link key={club.id} href={`/clubs/${club.id}`}>
                      <div className="flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-200 bg-white border border-slate-200/60 hover:border-slate-300 hover:shadow-md"
                        style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-xl shrink-0">
                          {club.iconUrl ?? '📌'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 leading-tight"
                            style={{ fontFamily: 'var(--font-manrope)' }}>
                            {club.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">Advisor: {advisor?.name ?? '—'}</p>
                          {position && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 mt-1.5 inline-block">
                              {position.title}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                          <Users className="w-3.5 h-3.5" />
                          {club.memberIds.length}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          )}

          {/* ── Tab: Attendance ── */}
          {tab === 'attendance' && profileUser.role === 'student' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: `${attendancePct}%`, label: 'Rate', icon: <Flame className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { value: `${presentCount}`, label: 'Attended', icon: <Check className="w-4 h-4" />, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { value: `${totalMeetings}`, label: 'Total', icon: <BookOpen className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(({ value, label, icon, color, bg }) => (
                  <div key={label} className="rounded-2xl bg-white border border-slate-200/60 p-5 text-center"
                    style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
                    <div className={`w-8 h-8 rounded-lg ${bg} ${color} flex items-center justify-center mx-auto mb-2`}>{icon}</div>
                    <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>{value}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-700 rounded-xl px-4 py-3 bg-amber-50 border border-amber-100">
                <EyeOff className="w-3.5 h-3.5 shrink-0" />
                Attendance is private — only visible to you and your club advisors.
              </div>

              {memberClubs.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">No club memberships to show attendance for.</p>
              ) : (
                memberClubs.map((club) => (
                  <AttendanceCalendar key={club.id} clubName={club.name} records={getClubAttendance(club.id)} />
                ))
              )}
            </div>
          )}

          {/* ── Tab: Achievements ── */}
          {tab === 'achievements' && <BadgeGrid userId={profileUser.id} />}
        </div>
      </div>
    </div>
  )
}
