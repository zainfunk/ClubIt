'use client'

import { useState, useEffect } from 'react'
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
import {
  Pencil, Check, X, Shield, Plus, Trash2,
  ExternalLink, EyeOff, Users, Mail, BadgeCheck,
  Trophy, Star, Flame, BookOpen, Award, Zap, AlertCircle,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', advisor: 'Faculty Advisor', student: 'Student Member',
}

type Tab = 'overview' | 'clubs' | 'attendance' | 'achievements'

// Derived achievements based on real user data
function computeAchievements(
  memberClubs: import('@/types').Club[],
  allRecords: AttendanceRecord[],
) {
  const achievements: { icon: React.ReactNode; title: string; desc: string; earned: boolean }[] = []
  const totalMeetings = allRecords.length
  const presentCount = allRecords.filter((r) => r.present).length
  const pct = totalMeetings > 0 ? presentCount / totalMeetings : 0

  achievements.push({
    icon: <BookOpen className="w-5 h-5" />,
    title: 'Club Member',
    desc: 'Joined your first club',
    earned: memberClubs.length >= 1,
  })
  achievements.push({
    icon: <Users className="w-5 h-5" />,
    title: 'Multitasker',
    desc: 'Active in 2 or more clubs',
    earned: memberClubs.length >= 2,
  })
  achievements.push({
    icon: <Star className="w-5 h-5" />,
    title: 'Leader',
    desc: 'Hold a leadership position',
    earned: memberClubs.some((c) => c.leadershipPositions.some((lp) => lp.userId !== undefined)),
  })
  achievements.push({
    icon: <Flame className="w-5 h-5" />,
    title: 'Committed',
    desc: 'Attended 80%+ of meetings',
    earned: pct >= 0.8 && totalMeetings > 0,
  })
  achievements.push({
    icon: <Trophy className="w-5 h-5" />,
    title: 'Perfect Attendance',
    desc: 'Never missed a meeting',
    earned: totalMeetings > 0 && presentCount === totalMeetings,
  })
  achievements.push({
    icon: <Zap className="w-5 h-5" />,
    title: 'High Participation',
    desc: 'Attended 10+ meetings total',
    earned: presentCount >= 10,
  })
  return achievements
}

export default function ProfilePage() {
  const { currentUser } = useMockAuth()

  const isAdmin = currentUser.role === 'admin'

  // Admins can browse other users in the current school
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [schoolUsers, setSchoolUsers] = useState<User[]>([])

  useEffect(() => {
    if (!currentUser.schoolId) return
    fetchSchoolUsers(currentUser.schoolId).then(setSchoolUsers)
  }, [currentUser.schoolId])

  const profileUser = isAdmin && selectedUserId
    ? (schoolUsers.find((u) => u.id === selectedUserId) ?? currentUser)
    : currentUser

  const canEdit = isAdmin || profileUser.id === currentUser.id

  const [profile, setProfileState] = useState({ bio: '', skills: [] as string[], interests: [] as string[], socials: [] as PersonalSocialLink[] })
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  useEffect(() => {
    setProfileLoading(true)
    setProfileError(null)
    Promise.all([
      getProfile(profileUser.id).then(setProfileState),
    ]).catch((err) => {
      setProfileError(err instanceof Error ? err.message : 'Failed to load profile')
    }).finally(() => setProfileLoading(false))
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

  const achievements = computeAchievements(memberClubs, allAttendanceRecords)
  const earnedCount = achievements.filter((a) => a.earned).length

  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'clubs', label: profileUser.role === 'advisor' ? 'CLUBS ADVISED' : 'MY CLUBS' },
    ...(profileUser.role === 'student' ? [{ key: 'attendance' as Tab, label: 'ATTENDANCE' }] : []),
    { key: 'achievements', label: 'ACHIEVEMENTS' },
  ]

  // Guard after all hooks — currentUser.id is empty during the loading state
  if (!currentUser.id) return null

  if (profileLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl overflow-hidden bg-white p-6" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <Skeleton className="h-2 w-full mb-6" />
        <div className="flex items-center gap-4 mb-5">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl p-3" style={{ background: '#f8f9fa' }}>
              <Skeleton className="h-5 w-8 mx-auto mb-1" />
              <Skeleton className="h-2 w-12 mx-auto" />
            </div>
          ))}
        </div>
        <Skeleton className="h-3 w-10 mb-2" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  )

  const roleAccent: Record<string, string> = {
    admin:   '#EF4444',
    advisor: '#3B82F6',
    student: '#10B981',
  }
  const accent = roleAccent[profileUser.role]

  return (
    <div className="max-w-2xl mx-auto space-y-0">

      {/* Error banner */}
      {profileError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load profile</p>
            <p className="text-xs text-red-600 mt-0.5">{profileError}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* Admin user selector */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
          style={{ background: 'rgba(239,68,68,0.06)' }}>
          <Shield className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700 mr-1">Viewing:</span>
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => {
              setSelectedUserId(e.target.value)
              setEditingEmail(false)
              setEditingSocials(false)
              setTab('overview')
            }}
            className="text-sm rounded-lg px-2 py-1 bg-white text-gray-700 cursor-pointer flex-1 border-0"
          >
            {schoolUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="rounded-2xl overflow-hidden mb-0" style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>

        {/* Top accent strip — thin, not a full banner */}
        <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 100%)` }} />

        {/* Content */}
        <div className="px-6 pt-6 pb-6">

          {/* Avatar + name row */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl p-1 shrink-0" style={{ background: `${accent}14`, boxShadow: `0 4px 16px ${accent}22` }}>
                <Avatar name={profileUser.name} size="lg" />
              </div>
              <div>
                {/* Name */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {canEdit ? (
                    <Input
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => e.key === 'Enter' && saveName()}
                      className="h-8 text-xl font-bold max-w-xs"
                      style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-[#191c1d]"
                      style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                      {profileUser.name}
                    </h1>
                  )}
                  <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: accent }} />
                </div>
                {/* Role */}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_BADGE[profileUser.role]}`}>
                    {profileUser.role}
                  </span>
                  <span className="text-sm text-[#727785]">{ROLE_LABEL[profileUser.role]}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <a href={`mailto:${profileUser.email}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-[#191c1d] transition-all"
                style={{ background: '#f3f4f5' }}>
                <Mail style={{ width: '0.75rem', height: '0.75rem' }} />
                Message
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { value: displayClubs.length, label: 'Clubs' },
              ...(profileUser.role === 'student' ? [
                { value: `${attendancePct}%`, label: 'Attendance' },
                { value: earnedCount, label: 'Achievements' },
              ] : []),
              { value: memberClubs.filter((c) => c.leadershipPositions.some((lp) => lp.userId === profileUser.id)).length, label: 'Leadership' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#f8f9fa' }}>
                <p className="text-xl font-bold text-[#191c1d]" style={{ fontFamily: 'var(--font-manrope)' }}>{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div className="mb-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785] block mb-1.5">Bio</label>
            {canEdit ? (
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                onBlur={saveBio}
                rows={3}
                placeholder="Write a short bio…"
                className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0058be] resize-none"
                style={{ background: '#f3f4f5', border: 'none' }}
              />
            ) : (
              <p className="text-sm text-[#424754] leading-relaxed">
                {profile.bio || <span className="text-[#a0a3ad] italic">No bio yet.</span>}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785] block mb-1.5">Contact</label>
            <div className="flex items-center gap-2">
              {editingEmail ? (
                <>
                  <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    className="h-7 text-xs max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                  <button onClick={saveEmail} className="text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingEmail(false)} className="text-[#727785]"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="text-sm text-[#424754]">{profileUser.email}</span>
                  {canEdit && (
                    <button onClick={() => { setEmailInput(profileUser.email); setEditingEmail(true) }}
                      className="text-[#727785] hover:text-[#191c1d]">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Socials — hidden for students when admin has disabled student socials */}
          {(isAdmin || profileUser.role !== 'student' || getAdminSettings().studentSocialsEnabled) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Socials</label>
              {canEdit && !editingSocials && (
                <button onClick={startEditSocials} className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {editingSocials ? (
              <div className="space-y-2">
                {socialsInput.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <select value={s.label}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="text-xs rounded-lg px-2 py-1 w-32" style={{ background: '#f3f4f5', border: 'none' }}>
                      {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <Input value={s.url}
                      onChange={(e) => setSocialsInput((prev) => prev.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://…" className="h-7 text-xs flex-1" />
                    <button onClick={() => setSocialsInput((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid #f3f4f5' }}>
                  <select value={newSocialLabel} onChange={(e) => setNewSocialLabel(e.target.value)}
                    className="text-xs rounded-lg px-2 py-1 w-32" style={{ background: '#f3f4f5', border: 'none' }}>
                    {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)}
                    placeholder="https://…" className="h-7 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addSocial()} />
                  <button onClick={addSocial} className="text-[#0058be] hover:text-[#004395]">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={saveSocials} className="text-xs text-emerald-700 font-semibold hover:underline">Save</button>
                  <button onClick={() => setEditingSocials(false)} className="text-xs text-[#727785]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.socials.length === 0 ? (
                  <p className="text-sm text-[#a0a3ad] italic">
                    No socials linked.{canEdit ? ' Click "Edit Profile" to add.' : ''}
                  </p>
                ) : (
                  profile.socials.map((s) => (
                    <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium text-[#424754] hover:bg-[#edeeef] transition-colors"
                      style={{ background: '#f3f4f5' }}>
                      <ExternalLink className="w-3 h-3" />
                      {s.label}
                    </a>
                  ))
                )}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(194,198,214,0.3)' }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-[11px] font-bold tracking-widest transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#0058be] text-[#0058be]'
                : 'border-transparent text-[#727785] hover:text-[#191c1d]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5 space-y-4">

        {/* ── Tab: Overview ── */}
        {tab === 'overview' && (
          <>
            {/* Active memberships */}
            {displayClubs.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-4">
                  Active Memberships
                </h3>
                <div className="space-y-3">
                  {displayClubs.map((club) => {
                    const advisor = resolveUser(club.advisorId)
                    const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
                    return (
                      <Link key={club.id} href={`/clubs/${club.id}`}>
                        <div className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-[#f8f9fa]">
                          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0"
                            style={{ background: '#f3f4f5' }}>
                            {club.iconUrl ?? '📌'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#191c1d] text-sm leading-tight"
                              style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                              {club.name}
                            </p>
                            <p className="text-xs text-[#727785]">
                              Advisor: {advisor?.name ?? '—'}
                            </p>
                          </div>
                          {position && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: 'rgba(146,71,0,0.1)', color: '#924700' }}>
                              {position.title}
                            </span>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Activity Snapshot */}
            {profileUser.role === 'student' && (
              <div className="rounded-2xl p-5"
                style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-4">
                  Activity Snapshot
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Engagement',
                      value: attendancePct >= 80 ? 'High' : attendancePct >= 50 ? 'Medium' : 'Low',
                      color: attendancePct >= 80 ? '#10B981' : attendancePct >= 50 ? '#F59E0B' : '#EF4444',
                    },
                    {
                      label: 'Standing',
                      value: earnedCount >= 4 ? 'Elite' : earnedCount >= 2 ? 'Active' : 'New',
                      color: earnedCount >= 4 ? '#0058be' : earnedCount >= 2 ? '#924700' : '#727785',
                    },
                    {
                      label: 'Meetings',
                      value: `${presentCount}/${totalMeetings}`,
                      color: '#191c1d',
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#f8f9fa' }}>
                      <p className="text-base font-bold" style={{ color, fontFamily: 'var(--font-manrope, sans-serif)' }}>
                        {value}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: My Clubs ── */}
        {tab === 'clubs' && (
          <div className="space-y-3">
            {displayClubs.length === 0 ? (
              <p className="text-sm text-[#727785] italic py-6">
                {profileUser.role === 'advisor' ? 'Not advising any clubs.' : 'Not a member of any clubs yet.'}
              </p>
            ) : (
              displayClubs.map((club) => {
                const advisor = resolveUser(club.advisorId)
                const position = club.leadershipPositions.find((lp) => lp.userId === profileUser.id)
                return (
                  <Link key={club.id} href={`/clubs/${club.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01]"
                      style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
                        style={{ background: '#f3f4f5' }}>
                        {club.iconUrl ?? '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#191c1d] leading-tight"
                          style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                          {club.name}
                        </p>
                        <p className="text-xs text-[#727785]">Advisor: {advisor?.name ?? '—'}</p>
                        {position && (
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 inline-block"
                            style={{ background: 'rgba(146,71,0,0.1)', color: '#924700' }}>
                            {position.title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#727785] shrink-0">
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
            {/* Stats header */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: `${attendancePct}%`, label: 'Streak', icon: <Flame className="w-4 h-4" />, color: '#10B981' },
                { value: `${presentCount}`, label: 'Attended', icon: <Check className="w-4 h-4" />, color: '#0058be' },
                { value: `${totalMeetings}`, label: 'Total', icon: <BookOpen className="w-4 h-4" />, color: '#924700' },
              ].map(({ value, label, icon, color }) => (
                <div key={label} className="rounded-2xl p-4 text-center"
                  style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-center mb-1" style={{ color }}>{icon}</div>
                  <p className="text-2xl font-bold text-[#191c1d]"
                    style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Privacy notice */}
            <div className="flex items-center gap-2 text-xs text-amber-700 rounded-xl px-4 py-3"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              Attendance is private — only visible to you and your club advisors.
            </div>

            {memberClubs.length === 0 ? (
              <p className="text-sm text-[#727785] italic py-4">No club memberships to show attendance for.</p>
            ) : (
              memberClubs.map((club) => (
                <AttendanceCalendar key={club.id} clubName={club.name} records={getClubAttendance(club.id)} />
              ))
            )}
          </div>
        )}

        {/* ── Tab: Achievements ── */}
        {tab === 'achievements' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-2xl p-5 flex items-center gap-4"
              style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,88,190,0.08)' }}>
                <Award className="w-7 h-7 text-[#0058be]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#191c1d]"
                  style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                  {earnedCount} / {achievements.length}
                </p>
                <p className="text-sm text-[#727785]">Achievements earned</p>
              </div>
            </div>

            {/* Achievement grid */}
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((a) => (
                <div key={a.title}
                  className="rounded-2xl p-4 flex items-start gap-3 transition-all"
                  style={{
                    background: a.earned ? '#ffffff' : '#f8f9fa',
                    boxShadow: a.earned ? '0 8px 24px rgba(0,0,0,0.05)' : 'none',
                    opacity: a.earned ? 1 : 0.5,
                  }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: a.earned ? 'rgba(0,88,190,0.08)' : '#edeeef',
                      color: a.earned ? '#0058be' : '#727785',
                    }}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#191c1d] leading-tight"
                      style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                      {a.title}
                    </p>
                    <p className="text-xs text-[#727785] mt-0.5 leading-tight">{a.desc}</p>
                    {a.earned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-widest mt-1"
                        style={{ color: '#10B981' }}>
                        <Check className="w-3 h-3" /> Earned
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
