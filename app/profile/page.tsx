'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useMockAuth } from '@/lib/mock-auth'
import { USERS, getClubsByMember, getClubsByAdvisor, getAttendanceByUserAndClub, getUserById } from '@/lib/mock-data'
import { setName, setEmail, applyOverrides } from '@/lib/user-store'
import { getProfile, setProfile, PRESET_SKILLS, PRESET_INTERESTS, SOCIAL_PLATFORMS, PersonalSocialLink } from '@/lib/profile-store'
import { getRecordsByClub } from '@/lib/attendance-store'
import { AttendanceRecord } from '@/types'
import Avatar from '@/components/Avatar'
import { Input } from '@/components/ui/input'
import AttendanceCalendar from '@/components/profile/AttendanceCalendar'
import TagEditor from '@/components/profile/TagEditor'
import {
  Pencil, Check, X, Shield, Plus, Trash2,
  ExternalLink, EyeOff, Users, Mail, BadgeCheck,
  Trophy, Star, Flame, BookOpen, Award, Zap,
} from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-red-100 text-red-700 border-red-200',
  advisor: 'bg-blue-100 text-blue-700 border-blue-200',
  student: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const ROLE_GRADIENT: Record<string, string> = {
  admin:   'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)',
  advisor: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 100%)',
  student: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)',
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', advisor: 'Faculty Advisor', student: 'Student Member',
}

type Tab = 'overview' | 'clubs' | 'attendance' | 'achievements'

// Derived achievements based on real user data
function computeAchievements(
  memberClubs: ReturnType<typeof getClubsByMember>,
  allRecords: AttendanceRecord[],
) {
  const achievements: { icon: React.ReactNode; title: string; desc: string; earned: boolean }[] = []
  const totalMeetings = allRecords.length
  const presentCount = allRecords.filter((r) => r.present).length
  const pct = totalMeetings > 0 ? presentCount / totalMeetings : 0
  const leadershipCount = memberClubs.filter((c) =>
    c.leadershipPositions.some((lp) => lp.userId !== undefined),
  ).length

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
  const { currentUser, setCurrentUser } = useMockAuth()
  const isAdmin = currentUser.role === 'admin'

  const [selectedUserId, setSelectedUserId] = useState(currentUser.id)
  const [displayUsers, setDisplayUsers] = useState(() => USERS.map(applyOverrides))

  function refresh() { setDisplayUsers(USERS.map(applyOverrides)) }

  const profileUser = isAdmin
    ? (displayUsers.find((u) => u.id === selectedUserId) ?? displayUsers[0])
    : displayUsers.find((u) => u.id === currentUser.id)!

  const canEdit = isAdmin || profileUser.id === currentUser.id
  const isOwnProfile = profileUser.id === currentUser.id

  const [profile, setProfileState] = useState({ bio: '', skills: [] as string[], interests: [] as string[], socials: [] as PersonalSocialLink[] })
  useEffect(() => { setProfileState(getProfile(profileUser.id)) }, [profileUser.id])

  function saveProfile(partial: Parameters<typeof setProfile>[1]) {
    setProfile(profileUser.id, partial)
    setProfileState(getProfile(profileUser.id))
  }

  // ---- Name editing ----
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  function saveName() {
    if (!nameInput.trim()) return
    setName(profileUser.id, nameInput.trim())
    refresh()
    if (profileUser.id === currentUser.id) setCurrentUser({ ...currentUser, name: nameInput.trim() })
    setEditingName(false)
  }

  // ---- Email editing ----
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  function saveEmail() {
    if (!emailInput.trim()) return
    setEmail(profileUser.id, emailInput.trim())
    refresh()
    if (profileUser.id === currentUser.id) setCurrentUser({ ...currentUser, email: emailInput.trim() })
    setEditingEmail(false)
  }

  // ---- Bio editing ----
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')

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
  const memberClubs = profileUser.role === 'student' || profileUser.role === 'admin'
    ? getClubsByMember(profileUser.id) : []
  const advisingClubs = profileUser.role === 'advisor' || profileUser.role === 'admin'
    ? getClubsByAdvisor(profileUser.id) : []
  const displayClubs = profileUser.role === 'advisor' ? advisingClubs : memberClubs

  function getClubAttendance(clubId: string): AttendanceRecord[] {
    const mock = getAttendanceByUserAndClub(profileUser.id, clubId)
    const stored = getRecordsByClub(clubId).filter((r) => r.userId === profileUser.id)
    const merged = new Map<string, AttendanceRecord>()
    for (const r of mock) merged.set(r.meetingDate, r)
    for (const r of stored) merged.set(r.meetingDate, r)
    return Array.from(merged.values()).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate))
  }

  const allAttendanceRecords = useMemo(() => {
    return memberClubs.flatMap((c) => getClubAttendance(c.id))
  }, [profileUser.id, memberClubs.length])

  const totalMeetings = allAttendanceRecords.length
  const presentCount = allAttendanceRecords.filter((r) => r.present).length
  const attendancePct = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0

  const achievements = useMemo(
    () => computeAchievements(memberClubs, allAttendanceRecords),
    [memberClubs.length, allAttendanceRecords.length],
  )
  const earnedCount = achievements.filter((a) => a.earned).length

  const [tab, setTab] = useState<Tab>('overview')
  const [editingProfile, setEditingProfile] = useState(false)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'clubs', label: profileUser.role === 'advisor' ? 'CLUBS ADVISED' : 'MY CLUBS' },
    ...(profileUser.role === 'student' ? [{ key: 'attendance' as Tab, label: 'ATTENDANCE' }] : []),
    { key: 'achievements', label: 'ACHIEVEMENTS' },
  ]

  const roleAccent: Record<string, string> = {
    admin:   '#EF4444',
    advisor: '#3B82F6',
    student: '#10B981',
  }
  const accent = roleAccent[profileUser.role]

  return (
    <div className="max-w-2xl mx-auto space-y-0">

      {/* Admin user selector */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-5"
          style={{ background: 'rgba(239,68,68,0.06)' }}>
          <Shield className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-sm font-medium text-red-700 mr-1">Viewing:</span>
          <select
            value={selectedUserId}
            onChange={(e) => {
              setSelectedUserId(e.target.value)
              setEditingName(false); setEditingEmail(false)
              setEditingBio(false); setEditingSocials(false)
              setEditingProfile(false); setTab('overview')
            }}
            className="text-sm rounded-lg px-2 py-1 bg-white text-gray-700 cursor-pointer flex-1 border-0"
          >
            {displayUsers.map((u) => (
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
                {editingProfile && isAdmin && editingName ? (
                  <div className="flex items-center gap-2 mb-1">
                    <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                      className="h-8 text-sm max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                    <button onClick={saveName} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingName(false)} className="text-[#727785]"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-[#191c1d]"
                      style={{ fontFamily: 'var(--font-manrope)', letterSpacing: '-0.02em' }}>
                      {profileUser.name}
                    </h1>
                    <BadgeCheck className="w-5 h-5 shrink-0" style={{ color: accent }} />
                    {editingProfile && isAdmin && (
                      <button onClick={() => { setNameInput(profileUser.name); setEditingName(true) }}
                        className="text-[#727785] hover:text-[#191c1d]">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
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
              {canEdit && (
                <button onClick={() => setEditingProfile((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all"
                  style={{ background: editingProfile ? '#0058be' : '#f3f4f5', color: editingProfile ? '#ffffff' : '#191c1d' }}>
                  <Pencil style={{ width: '0.75rem', height: '0.75rem' }} />
                  {editingProfile ? 'Done' : 'Edit'}
                </button>
              )}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Bio</label>
              {canEdit && editingProfile && !editingBio && (
                <button onClick={() => { setBioInput(profile.bio); setEditingBio(true) }}
                  className="text-[#727785] hover:text-[#191c1d]">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editingBio ? (
              <div>
                <textarea value={bioInput} onChange={(e) => setBioInput(e.target.value)} rows={3}
                  placeholder="Write a short bio…"
                  className="w-full text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0058be] resize-none"
                  style={{ background: '#f3f4f5', border: 'none' }} autoFocus />
                <div className="flex gap-3 mt-1.5">
                  <button onClick={() => { saveProfile({ bio: bioInput }); setEditingBio(false) }}
                    className="text-xs text-emerald-700 font-semibold hover:underline">Save</button>
                  <button onClick={() => setEditingBio(false)} className="text-xs text-[#727785]">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#424754] leading-relaxed">
                {profile.bio || <span className="text-[#a0a3ad] italic">No bio yet.{canEdit ? ' Click "Edit Profile" to add one.' : ''}</span>}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785] block mb-1.5">Contact</label>
            <div className="flex items-center gap-2">
              {editingProfile && editingEmail ? (
                <>
                  <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    className="h-7 text-xs max-w-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && saveEmail()} />
                  <button onClick={saveEmail} className="text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditingEmail(false)} className="text-[#727785]"><X className="w-3.5 h-3.5" /></button>
                </>
              ) : (
                <>
                  <span className="text-sm text-[#424754]">{profileUser.email}</span>
                  {canEdit && editingProfile && (
                    <button onClick={() => { setEmailInput(profileUser.email); setEditingEmail(true) }}
                      className="text-[#727785] hover:text-[#191c1d]">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Socials */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[#727785]">Socials</label>
              {canEdit && editingProfile && !editingSocials && (
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
            {/* Skills */}
            <div className="rounded-2xl p-5"
              style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <TagEditor
                label="Skills & Expertise"
                presets={PRESET_SKILLS}
                selected={profile.skills}
                onChange={(skills) => saveProfile({ skills })}
                editable={canEdit}
              />
            </div>

            {/* Interests */}
            <div className="rounded-2xl p-5"
              style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
              <TagEditor
                label="Interests"
                presets={PRESET_INTERESTS}
                selected={profile.interests}
                onChange={(interests) => saveProfile({ interests })}
                editable={canEdit}
              />
            </div>

            {/* Active memberships */}
            {displayClubs.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: '#ffffff', boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#727785] mb-4">
                  Active Memberships
                </h3>
                <div className="space-y-3">
                  {displayClubs.map((club) => {
                    const advisor = getUserById(club.advisorId)
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
                const advisor = getUserById(club.advisorId)
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
