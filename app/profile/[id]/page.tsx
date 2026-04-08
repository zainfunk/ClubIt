'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { fetchClubsByIds, fetchSchoolClubs, fetchUsersByIds } from '@/lib/school-data'
import { supabase } from '@/lib/supabase'
import { setName, setEmail } from '@/lib/user-store'
import {
  getProfile, setProfile as saveProfileStore,
  SOCIAL_PLATFORMS, PersonalSocialLink,
} from '@/lib/profile-store'
import {
  getAdminSettings, canViewAchievements, canViewAttendance, canViewClubs,
} from '@/lib/settings-store'
import { getRecordsByClub } from '@/lib/attendance-store'
import { AttendanceRecord, Club, User, Role } from '@/types'
import Avatar from '@/components/Avatar'
import { Input } from '@/components/ui/input'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import {
  ExternalLink, EyeOff, Users, Shield, Eye,
  Pencil, Check, X, Plus, Trash2,
  BadgeCheck, Mail, Trophy, Star, Flame, BookOpen, Award, Zap,
} from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', advisor: 'Faculty Advisor', student: 'Student Member',
}

const roleAccent: Record<string, string> = {
  admin: '#EF4444', advisor: '#3B82F6', student: '#10B981',
}

type Tab = 'overview' | 'clubs' | 'attendance' | 'achievements'

function computeAchievements(
  memberClubs: Club[],
  allRecords: AttendanceRecord[],
) {
  const presentCount = allRecords.filter((r) => r.present).length
  const totalMeetings = allRecords.length
  const pct = totalMeetings > 0 ? presentCount / totalMeetings : 0

  return [
    { icon: <BookOpen className="w-5 h-5" />, title: 'Club Member', desc: 'Joined your first club', earned: memberClubs.length >= 1 },
    { icon: <Users className="w-5 h-5" />, title: 'Multitasker', desc: 'Active in 2 or more clubs', earned: memberClubs.length >= 2 },
    { icon: <Star className="w-5 h-5" />, title: 'Leader', desc: 'Hold a leadership position', earned: memberClubs.some((c) => c.leadershipPositions.some((lp) => lp.userId !== undefined)) },
    { icon: <Flame className="w-5 h-5" />, title: 'Committed', desc: 'Attended 80%+ of meetings', earned: pct >= 0.8 && totalMeetings > 0 },
    { icon: <Trophy className="w-5 h-5" />, title: 'Perfect Attendance', desc: 'Never missed a meeting', earned: totalMeetings > 0 && presentCount === totalMeetings },
    { icon: <Zap className="w-5 h-5" />, title: 'High Participation', desc: 'Attended 10+ meetings total', earned: presentCount >= 10 },
  ]
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ViewProfilePage({ params }: PageProps) {
  const { id } = use(params)
  const { currentUser } = useMockAuth()

  const [rawUser, setRawUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    if (!currentUser.schoolId) {
      Promise.resolve().then(() => setUserLoading(false))
      return
    }

    fetchUsersByIds([id]).then((users) => {
      setRawUser(users[id] ?? null)
      setUserLoading(false)
    })
  }, [currentUser.schoolId, id])

  // Safe placeholder so hooks below can always derive values (shown only during load)
  const profileUser = rawUser ?? { id, name: '', email: '', role: 'student' as Role }

  const isAdmin = currentUser.role === 'admin'
  const isAdvisor = currentUser.role === 'advisor'
  const isOwnProfile = currentUser.id === profileUser.id

  const accent = roleAccent[profileUser.role] ?? roleAccent.student

  const [profile, setProfileState] = useState({
    bio: '', skills: [] as string[], interests: [] as string[], socials: [] as PersonalSocialLink[],
  })
  useEffect(() => {
    if (!rawUser) return
    getProfile(profileUser.id).then(setProfileState)
  }, [profileUser.id, rawUser])

  async function persistProfile(partial: Parameters<typeof saveProfileStore>[1]) {
    await saveProfileStore(profileUser.id, partial)
    getProfile(profileUser.id).then(setProfileState)
  }

  // ---- Name editing (admin only) ----
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayEmail, setDisplayEmail] = useState('')

  useEffect(() => {
    if (!rawUser) return
    Promise.resolve().then(() => {
      setDisplayName(rawUser.name)
      setDisplayEmail(rawUser.email)
    })
  }, [id, rawUser])

  function saveName() {
    if (!nameInput.trim()) return
    void setName(profileUser.id, nameInput.trim())
    setDisplayName(nameInput.trim())
    setEditingName(false)
  }

  // ---- Email editing (admin only) ----
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  function saveEmail() {
    if (!emailInput.trim()) return
    void setEmail(profileUser.id, emailInput.trim())
    setDisplayEmail(emailInput.trim())
    setEditingEmail(false)
  }

  // ---- Bio editing (admin only) ----
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')

  // ---- Socials editing (admin only) ----
  const [editingSocials, setEditingSocials] = useState(false)
  const [socialsInput, setSocialsInput] = useState<PersonalSocialLink[]>([])
  const [newSocialLabel, setNewSocialLabel] = useState(SOCIAL_PLATFORMS[0])
  const [newSocialUrl, setNewSocialUrl] = useState('')

  function startEditSocials() {
    setSocialsInput(profile.socials.map((s) => ({ ...s })))
    setEditingSocials(true)
  }
  function saveSocials() {
    persistProfile({ socials: socialsInput.filter((s) => s.url.trim()) })
    setEditingSocials(false)
  }
  function addSocial() {
    if (!newSocialUrl.trim()) return
    setSocialsInput((prev) => [...prev, { id: `social-${Date.now()}`, label: newSocialLabel, url: newSocialUrl.trim() }])
    setNewSocialUrl('')
  }

  // ---- Clubs & attendance ----
  const [memberClubs, setMemberClubs] = useState<Club[]>([])
  const [advisingClubs, setAdvisingClubs] = useState<Club[]>([])
  const [usersById, setUsersById] = useState<Record<string, User>>({})
  const displayClubs = profileUser.role === 'advisor' ? advisingClubs : memberClubs

  useEffect(() => {
    if (!profileUser.id || !currentUser.schoolId) return

    supabase.from('memberships').select('club_id').eq('user_id', profileUser.id).then(({ data }) => {
      const clubIds = (data ?? []).map((row) => row.club_id)
      if (clubIds.length > 0) {
        fetchClubsByIds(clubIds).then(setMemberClubs)
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

  useEffect(() => {
    const relatedUserIds = Array.from(new Set([
      rawUser?.id ?? '',
      ...memberClubs.flatMap((club) => [club.advisorId, ...club.memberIds]),
      ...advisingClubs.flatMap((club) => [club.advisorId, ...club.memberIds]),
    ].filter(Boolean)))

    if (relatedUserIds.length === 0) {
      Promise.resolve().then(() => setUsersById({}))
      return
    }

    fetchUsersByIds(relatedUserIds).then(setUsersById)
  }, [advisingClubs, memberClubs, rawUser?.id])

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

  function resolveUser(userId: string) {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : rawUser?.id === userId ? rawUser : undefined)
  }

  // Shared club IDs between advisor and this student (for attendance visibility)
  const sharedClubIds = isAdvisor
    ? memberClubs.filter((c) => c.advisorId === currentUser.id).map((c) => c.id)
    : []

  function getVisibleAttendanceClubs() {
    if (profileUser.role !== 'student') return []
    if (!canViewAttendance(currentUser.id, profileUser.id, currentUser.role, sharedClubIds)) return []
    if (isAdmin) return memberClubs
    if (isAdvisor) return memberClubs.filter((c) => c.advisorId === currentUser.id)
    return memberClubs
  }

  const attendanceClubs = getVisibleAttendanceClubs()
  const showClubs = canViewClubs(currentUser.id, profileUser.id, currentUser.role)
  const showAchievements = canViewAchievements(currentUser.id, profileUser.id, currentUser.role)
  const adminSettings = getAdminSettings()

  const allAttendanceRecords = memberClubs.flatMap((c) => getClubAttendance(c.id))

  const totalMeetings = allAttendanceRecords.length
  const presentCount = allAttendanceRecords.filter((r) => r.present).length
  const attendancePct = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0

  const achievements = computeAchievements(memberClubs, allAttendanceRecords)
  const earnedCount = achievements.filter((a) => a.earned).length

  const canSeeEmail = isAdmin || isAdvisor || isOwnProfile

  const [tab, setTab] = useState<Tab>('overview')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    ...(showClubs ? [{ key: 'clubs' as Tab, label: profileUser.role === 'advisor' ? 'CLUBS ADVISED' : 'CLUBS' }] : []),
    ...(profileUser.role === 'student' && attendanceClubs.length > 0 ? [{ key: 'attendance' as Tab, label: 'ATTENDANCE' }] : []),
    ...(showAchievements ? [{ key: 'achievements' as Tab, label: 'ACHIEVEMENTS' }] : []),
  ]

  // Guards after all hooks
  if (userLoading) return null
  if (!rawUser) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-0">

      {/* Admin notice */}
      {isAdmin && (
        <div className="flex items-center gap-2 text-xs text-red-700 rounded-xl px-4 py-3 mb-5"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.12)' }}>
          <Shield className="w-3.5 h-3.5 shrink-0" />
          Admin view — you can edit all fields on this profile.
        </div>
      )}
      {isAdvisor && attendanceClubs.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-700 rounded-xl px-4 py-3 mb-5"
          style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.12)' }}>
          <Eye className="w-3.5 h-3.5 shrink-0" />
          You can see attendance for clubs you advise.
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="rounded-2xl overflow-hidden mb-0" style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>

        <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 100%)` }} />

        <div className="px-6 pt-6 pb-6">

          {/* Avatar + name row */}
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl p-1 shrink-0" style={{ background: `${accent}14`, boxShadow: `0 4px 16px ${accent}22` }}>
                <Avatar name={displayName} size="lg" />
              </div>
              <div>
                {/* Name */}
                {isAdmin && editingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                      className="h-8 text-sm max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                    <button onClick={saveName} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingName(false)} className="text-[#727785]"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold text-[#191c1d]"
                      style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                      {displayName}
                    </h1>
                    <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: accent }} />
                    {isAdmin && (
                      <button onClick={() => { setNameInput(displayName); setEditingName(true) }}
                        className="text-[#727785] hover:text-[#191c1d]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${ROLE_BADGE[profileUser.role]}`}>
                    {profileUser.role}
                  </span>
                  <span className="text-sm text-[#727785]">{ROLE_LABEL[profileUser.role]}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a href={`mailto:${displayEmail}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-[#191c1d] transition-all"
                style={{ background: '#f3f4f5' }}>
                <Mail className="w-3 h-3" />
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Bio</label>
              {isAdmin && !editingBio && (
                <button onClick={() => { setBioInput(profile.bio); setEditingBio(true) }}
                  className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isAdmin && editingBio ? (
              <div>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} rows={3}
                  placeholder="Write a short bio…"
                  className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0058be] resize-none"
                  style={{ background: '#f3f4f5', border: 'none' }} autoFocus />
                <div className="flex gap-3 mt-1.5">
                  <button onClick={() => { persistProfile({ bio: bioInput }); setEditingBio(false) }}
                    className="text-xs text-emerald-700 font-semibold hover:underline">Save</button>
                  <button onClick={() => setEditingBio(false)} className="text-xs text-[#727785]">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#424754] leading-relaxed">
                {profile.bio || <span className="text-[#a0a3ad] italic">No bio yet.</span>}
              </p>
            )}
          </div>

          {/* Email */}
          {canSeeEmail && (
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785] block mb-1.5">Contact</label>
              <div className="flex items-center gap-2">
                {isAdmin && editingEmail ? (
                  <>
                    <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                      className="h-7 text-xs max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                    <button onClick={saveEmail} className="text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingEmail(false)} className="text-[#727785]"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-[#424754]">{displayEmail}</span>
                    {isAdmin && (
                      <button onClick={() => { setEmailInput(displayEmail); setEditingEmail(true) }}
                        className="text-[#727785] hover:text-[#191c1d]">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Socials — hidden for students when admin has disabled student socials */}
          {(isAdmin || isOwnProfile || profileUser.role !== 'student' || adminSettings.studentSocialsEnabled) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Socials</label>
              {isAdmin && !editingSocials && (
                <button onClick={startEditSocials} className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {isAdmin && editingSocials ? (
              <div className="space-y-2">
                {socialsInput.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <select value={s.label}
                      onChange={(e) => setSocialsInput((p) => p.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="text-xs rounded-lg px-2 py-1 w-32" style={{ background: '#f3f4f5', border: 'none' }}>
                      {SOCIAL_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <Input value={s.url}
                      onChange={(e) => setSocialsInput((p) => p.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))}
                      placeholder="https://…" className="h-7 text-xs flex-1" />
                    <button onClick={() => setSocialsInput((p) => p.filter((_, i) => i !== idx))}
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
                  <p className="text-sm text-[#a0a3ad] italic">No socials linked.</p>
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
                    { label: 'Engagement', value: attendancePct >= 80 ? 'High' : attendancePct >= 50 ? 'Medium' : 'Low', color: attendancePct >= 80 ? '#10B981' : attendancePct >= 50 ? '#F59E0B' : '#EF4444' },
                    { label: 'Standing', value: earnedCount >= 4 ? 'Elite' : earnedCount >= 2 ? 'Active' : 'New', color: earnedCount >= 4 ? '#0058be' : earnedCount >= 2 ? '#924700' : '#727785' },
                    { label: 'Meetings', value: `${presentCount}/${totalMeetings}`, color: '#191c1d' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#f8f9fa' }}>
                      <p className="text-base font-bold" style={{ color, fontFamily: 'var(--font-manrope, sans-serif)' }}>{value}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Clubs ── */}
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
        {tab === 'attendance' && attendanceClubs.length > 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: `${attendancePct}%`, label: 'Rate', color: '#10B981' },
                { value: `${presentCount}`, label: 'Attended', color: '#0058be' },
                { value: `${totalMeetings}`, label: 'Total', color: '#924700' },
              ].map(({ value, label, color }) => (
                <div key={label} className="rounded-2xl p-4 text-center"
                  style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                  <p className="text-2xl font-bold text-[#191c1d]"
                    style={{ fontFamily: 'var(--font-manrope, sans-serif)', color }}>{value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-700 rounded-xl px-4 py-3"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
              {isAdmin
                ? 'Attendance visible to you as admin.'
                : isOwnProfile
                ? 'This is your private attendance record.'
                : `Attendance for clubs you advise: ${attendanceClubs.map((c) => c.name).join(', ')}.`}
            </div>
            {attendanceClubs.map((club) => (
              <AttendanceCalendar key={club.id} clubName={club.name} records={getClubAttendance(club.id)} />
            ))}
          </div>
        )}

        {/* ── Tab: Achievements ── */}
        {tab === 'achievements' && (
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
              {achievements.map((a) => (
                <div key={a.title} className="rounded-2xl p-4 flex items-start gap-3 transition-all"
                  style={{
                    background: a.earned ? '#ffffff' : '#f8f9fa',
                    boxShadow: a.earned ? '0 8px 24px rgba(0,0,0,0.05)' : 'none',
                    opacity: a.earned ? 1 : 0.5,
                  }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: a.earned ? 'rgba(0,88,190,0.08)' : '#edeeef', color: a.earned ? '#0058be' : '#727785' }}>
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#191c1d] leading-tight"
                      style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>{a.title}</p>
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
