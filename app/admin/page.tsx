'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { Club, SchoolElection, User, Role } from '@/types'
import RoleGuard from '@/components/layout/RoleGuard'
import ClubForm from '@/components/admin/ClubForm'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { applyOverrides } from '@/lib/user-store'
import Avatar from '@/components/Avatar'
import { Users, Shield, Vote, Plus, GraduationCap, MessageSquare, CheckCircle, Clock, Copy, Check, KeyRound } from 'lucide-react'

export default function AdminPage() {
  const { actualUser } = useMockAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({})
  const [elections, setElections] = useState<SchoolElection[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [membershipsByUser, setMembershipsByUser] = useState<Record<string, string[]>>({})
  const [issueReports, setIssueReports] = useState<{ id: string; reporter_name: string; reporter_email: string; message: string; status: string; created_at: string }[]>([])
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [invites, setInvites] = useState<{ studentCode: string | null; advisorCode: string | null; adminCode: string | null } | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  function applyClubsPayload(payload: {
    clubs?: Club[]
    advisorNames?: Record<string, string>
  }) {
    setClubs(payload.clubs ?? [])
    setAdvisorNames(payload.advisorNames ?? {})
  }

  async function fetchClubsPayload() {
    const res = await fetch('/api/school/clubs', { cache: 'no-store' })
    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload.error ?? 'Failed to load clubs')
    }

    return payload as {
      clubs?: Club[]
      advisorNames?: Record<string, string>
    }
  }

  useEffect(() => {
    if (!actualUser.schoolId) return
    // Load users and their club memberships for this school
    supabase.from('users').select('id, name, email, role').eq('school_id', actualUser.schoolId).then(async ({ data }) => {
      if (!data?.length) return
      const users = data.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role as Role }))
      setAllUsers(users)

      const userIds = users.map((u) => u.id)
      const { data: memData } = await supabase.from('memberships').select('user_id, club_id').in('user_id', userIds)
      if (memData) {
        const map: Record<string, string[]> = {}
        for (const m of memData) {
          if (!map[m.user_id]) map[m.user_id] = []
          map[m.user_id].push(m.club_id)
        }
        setMembershipsByUser(map)
      }
    })
    // Load issue reports for this school
    supabase.from('issue_reports').select('*').eq('school_id', actualUser.schoolId).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setIssueReports(data)
    })
  }, [actualUser.schoolId])

  async function resolveIssue(id: string) {
    await supabase.from('issue_reports').update({ status: 'resolved' }).eq('id', id)
    setIssueReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r))
  }

  useEffect(() => {
    if (!actualUser.schoolId) return
    let cancelled = false
    fetch('/api/school/invites', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return
        setInvites({
          studentCode: data.studentCode ?? null,
          advisorCode: data.advisorCode ?? null,
          adminCode: data.adminCode ?? null,
        })
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [actualUser.schoolId])

  async function copyCode(label: string, code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(label)
      setTimeout(() => setCopiedCode((current) => current === label ? null : current), 1500)
    } catch {
      /* clipboard may be unavailable — silently ignore */
    }
  }

  useEffect(() => {
    if (!actualUser.schoolId) return
    // Load this school's elections via the server API (so it survives RLS).
    fetch('/api/school/elections', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.elections) setElections(data.elections as SchoolElection[])
      })
      .catch(() => { /* ignore */ })
    let cancelled = false

    async function loadClubs() {
      try {
        const payload = await fetchClubsPayload()
        if (cancelled) return

        applyClubsPayload(payload)
      } catch (err) {
        if (cancelled) return
        console.error('admin clubs load error', err)
      }
    }

    void loadClubs()

    return () => {
      cancelled = true
    }
  }, [actualUser.schoolId])

  // Election form state
  const [showElectionForm, setShowElectionForm] = useState(false)
  const [electionTitle, setElectionTitle] = useState('')
  const [electionDescription, setElectionDescription] = useState('')
  const [electionCandidateIds, setElectionCandidateIds] = useState<string[]>([])

  const staffOwners = Array.from(new Map(
    [
      ...(actualUser.id && (actualUser.role === 'admin' || actualUser.role === 'advisor')
        ? [{ id: actualUser.id, name: actualUser.name, email: actualUser.email, role: actualUser.role }]
        : []),
      ...allUsers.filter((u) => u.role === 'advisor' || u.role === 'admin'),
    ].map((user) => [user.id, user])
  ).values())
  const students = allUsers.filter((u) => u.role === 'student')

  async function updateUserRole(userId: string, role: Exclude<Role, 'superadmin'>) {
    setUpdatingRoleId(userId)
    setRoleError(null)

    try {
      const res = await fetch(`/api/school/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update role')

      setAllUsers((prev) => prev.map((user) => (
        user.id === userId
          ? { ...user, role: role as Role }
          : user
      )))
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setUpdatingRoleId(null)
    }
  }

  async function handleCreateClub(
    data: Omit<Club, 'id' | 'memberIds' | 'leadershipPositions' | 'socialLinks' | 'meetingTimes' | 'createdAt'>
  ) {
    const res = await fetch('/api/school/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload.error ?? 'Failed to create club')
    }

    applyClubsPayload(await fetchClubsPayload())
    setAllUsers((prev) => (
      prev.some((user) => user.id === actualUser.id)
        ? prev
        : [...prev, { ...actualUser }]
    ))
  }

  function toggleElectionCandidate(userId: string) {
    setElectionCandidateIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  async function createElection() {
    if (!electionTitle.trim() || electionCandidateIds.length < 2) return
    const res = await fetch('/api/school/elections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        positionTitle: electionTitle.trim(),
        description: electionDescription.trim(),
        candidateUserIds: electionCandidateIds,
      }),
    })
    const payload = await res.json()
    if (!res.ok) {
      console.error('create election error', payload.error)
      return
    }
    setElections((prev) => [payload.election as SchoolElection, ...prev])
    setElectionTitle('')
    setElectionDescription('')
    setElectionCandidateIds([])
    setShowElectionForm(false)
  }

  async function closeElection(id: string) {
    const res = await fetch(`/api/school/elections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen: false }),
    })
    if (!res.ok) return
    setElections((prev) => prev.map((e) => (e.id === id ? { ...e, isOpen: false } : e)))
  }

  function getUserById(id: string) {
    return allUsers.find((u) => u.id === id)
  }

  const openIssues = issueReports.filter((r) => r.status === 'open').length

  return (
    <RoleGuard allowed={['admin']}>
      <div className="space-y-6" style={{ fontFamily: 'var(--font-inter)' }}>

        {/* ── Invite Codes ── */}
        {invites && (invites.studentCode || invites.advisorCode || invites.adminCode) && (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/30 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <KeyRound className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Invite Codes</h2>
                <p className="text-xs text-slate-500">Share at <span className="font-mono text-indigo-600">/join</span> to onboard users</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: 'Students', code: invites.studentCode, color: 'text-emerald-600' },
                { label: 'Advisors', code: invites.advisorCode, color: 'text-indigo-600' },
                { label: 'Admins', code: invites.adminCode, color: 'text-rose-600' },
              ] as const).map(({ label, code, color }) => (
                <div key={label} className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
                    {code && (
                      <button onClick={() => copyCode(label, code)} className="text-[10px] font-semibold text-slate-400 hover:text-slate-700 transition inline-flex items-center gap-1">
                        {copiedCode === label ? <><Check className="w-3 h-3 text-emerald-500" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                    )}
                  </div>
                  {code ? (
                    <code className="font-mono text-sm font-bold text-slate-900 tracking-tight">{code}</code>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not set</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Clubs ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <ClubForm advisors={staffOwners} onSubmit={handleCreateClub} />
          </div>
          <div className="lg:col-span-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">All Clubs ({clubs.length})</h3>
            <div className="space-y-2">
              {clubs.map((club) => {
                const advisor = allUsers.find((u) => u.id === club.advisorId) ?? (club.advisorId === actualUser.id ? actualUser : undefined)
                const advisorName = advisor?.name ?? advisorNames[club.advisorId] ?? 'Unassigned'
                const pct = club.capacity ? Math.min((club.memberIds.length / club.capacity) * 100, 100) : 0
                const full = club.capacity !== null && club.memberIds.length >= club.capacity
                return (
                  <Link key={club.id} href={`/clubs/${club.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-lg shrink-0">{club.iconUrl ?? '📌'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">{club.name}</span>
                          {full && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">FULL</span>}
                        </div>
                        <span className="text-xs text-slate-400">{advisorName}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium text-slate-500">{club.memberIds.length}/{club.capacity ?? '∞'}</span>
                        {club.capacity && (
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${full ? 'bg-rose-400' : 'bg-gradient-to-r from-indigo-500 to-emerald-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Staff & Roles ── */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><Shield className="w-4 h-4 text-indigo-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Staff & Roles</h3>
              <p className="text-xs text-slate-500">Promote users to advisor or admin</p>
            </div>
          </div>
          {roleError && (
            <div className="px-5 py-2.5 bg-rose-50 text-sm text-rose-700 border-b border-rose-100">{roleError}</div>
          )}
          {allUsers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No users have joined this school yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {allUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={user.name} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">{user.name}</span>
                        {user.id === actualUser.id && <span className="text-[9px] font-bold text-slate-400 uppercase">you</span>}
                      </div>
                      <span className="text-xs text-slate-400">{user.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(['student', 'advisor', 'admin'] as Exclude<Role, 'superadmin'>[]).map((nextRole) => (
                      <button
                        key={nextRole}
                        disabled={updatingRoleId === user.id || user.role === nextRole}
                        onClick={() => updateUserRole(user.id, nextRole)}
                        className={`h-7 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                          user.role === nextRole
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200'
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                      >
                        {updatingRoleId === user.id ? '...' : nextRole}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Student Roster ── */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><GraduationCap className="w-4 h-4 text-emerald-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Student Roster</h3>
              <p className="text-xs text-slate-500">Click a name to view their profile</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                <th className="px-5 py-2.5 text-left">Student</th>
                <th className="px-5 py-2.5 text-left">Email</th>
                <th className="px-5 py-2.5 text-left">Clubs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {allUsers.filter((u) => u.role === 'student').map(applyOverrides).map((student) => {
                const studentClubIds = membershipsByUser[student.id] ?? []
                const studentClubs = studentClubIds.map((cid) => clubs.find((c) => c.id === cid)).filter(Boolean) as Club[]
                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-2.5">
                      <Link href={`/profile/${student.id}`} className="flex items-center gap-2.5 group">
                        <Avatar name={student.name} size="sm" />
                        <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{student.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-400">{student.email}</td>
                    <td className="px-5 py-2.5">
                      {studentClubs.length === 0 ? (
                        <span className="text-slate-300 italic text-xs">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {studentClubs.map((c) => (
                            <span key={c.id} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                              {c.iconUrl} {c.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Elections ── */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><Vote className="w-4 h-4 text-purple-600" /></div>
              <div>
                <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>School Elections</h3>
                <p className="text-xs text-slate-500">All students and staff can vote</p>
              </div>
            </div>
            <button onClick={() => setShowElectionForm((v) => !v)} className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-sm transition">
              <Plus className="w-3.5 h-3.5" />New Election
            </button>
          </div>

          {showElectionForm && (
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">New Election</p>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Position Title *</label>
                <Input value={electionTitle} onChange={(e) => setElectionTitle(e.target.value)} placeholder="e.g. Student Body President" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Description</label>
                <textarea value={electionDescription} onChange={(e) => setElectionDescription(e.target.value)} placeholder="Brief description…" rows={2}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Candidates * (select 2+)</label>
                <div className="grid grid-cols-2 gap-1">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer py-0.5">
                      <input type="checkbox" checked={electionCandidateIds.includes(s.id)} onChange={() => toggleElectionCandidate(s.id)} className="accent-indigo-600" />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={createElection} disabled={!electionTitle.trim() || electionCandidateIds.length < 2}
                  className="h-8 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  Launch Election
                </button>
                <button onClick={() => setShowElectionForm(false)} className="h-8 px-4 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition">Cancel</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-50">
            {elections.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No school elections yet.</p>
            ) : elections.map((election) => {
              const totalVotes = election.candidates.reduce((s, c) => s + c.votes.length, 0)
              const winner = !election.isOpen ? election.candidates.reduce((a, b) => (a.votes.length >= b.votes.length ? a : b)) : null
              return (
                <div key={election.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>{election.positionTitle}</p>
                      {election.description && <p className="text-xs text-slate-500 mt-0.5">{election.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${election.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {election.isOpen ? 'Open' : 'Closed'}
                      </span>
                      {election.isOpen && (
                        <button onClick={() => closeElection(election.id)} className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1 rounded-lg transition">Close</button>
                      )}
                    </div>
                  </div>
                  {winner && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mb-3 font-medium">
                      Winner: {getUserById(winner.userId)?.name} ({winner.votes.length} votes)
                    </div>
                  )}
                  <div className="space-y-2">
                    {election.candidates.map((c) => {
                      const user = getUserById(c.userId)
                      const pct = totalVotes > 0 ? Math.round((c.votes.length / totalVotes) * 100) : 0
                      return (
                        <div key={c.userId} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-700 w-24 shrink-0 truncate">{user?.name}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[11px] text-slate-400 w-16 text-right shrink-0">{c.votes.length} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Issue Reports ── */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><MessageSquare className="w-4 h-4 text-amber-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>Issue Reports</h3>
              <p className="text-xs text-slate-500">Submitted by students and staff</p>
            </div>
            {openIssues > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{openIssues} open</span>
            )}
          </div>
          {issueReports.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No reports yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {issueReports.map((report) => (
                <div key={report.id} className={`px-5 py-3.5 flex items-start justify-between gap-4 ${report.status === 'resolved' ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{report.reporter_name}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                        report.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>{report.status}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{report.message}</p>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  {report.status === 'open' && (
                    <button onClick={() => resolveIssue(report.id)} className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors">
                      <CheckCircle className="w-3 h-3" />Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
