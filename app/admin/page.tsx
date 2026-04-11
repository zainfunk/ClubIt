'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import { Club, SchoolElection, User, Role } from '@/types'
import RoleGuard from '@/components/layout/RoleGuard'
import ClubForm from '@/components/admin/ClubForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  return (
    <RoleGuard allowed={['admin']}>
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-red-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage clubs, advisors, and school elections</p>
          </div>
        </div>

        {/* Invite codes — share these so users can join via /join */}
        {invites && (invites.studentCode || invites.advisorCode || invites.adminCode) && (
          <Card className="mb-10 border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-emerald-50/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-sm">
                  <KeyRound className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Invite codes</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Share these with your school. New users enter them at <span className="font-mono">/join</span> to get the right role.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([
                  { label: 'Students', code: invites.studentCode, accent: 'emerald' },
                  { label: 'Advisors', code: invites.advisorCode, accent: 'indigo' },
                  { label: 'Admins', code: invites.adminCode, accent: 'rose' },
                ] as const).map(({ label, code, accent }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white border border-gray-100 p-4 flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        accent === 'emerald' ? 'text-emerald-600' :
                        accent === 'indigo' ? 'text-indigo-600' :
                        'text-rose-600'
                      }`}>
                        {label}
                      </span>
                      {code && (
                        <button
                          type="button"
                          onClick={() => copyCode(label, code)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-900 transition"
                          aria-label={`Copy ${label} invite code`}
                        >
                          {copiedCode === label ? (
                            <><Check className="w-3 h-3 text-emerald-500" /> Copied</>
                          ) : (
                            <><Copy className="w-3 h-3" /> Copy</>
                          )}
                        </button>
                      )}
                    </div>
                    {code ? (
                      <code className="font-mono text-sm font-bold text-gray-900 tracking-tight">
                        {code}
                      </code>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Not generated yet</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clubs section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1">
            <ClubForm advisors={staffOwners} onSubmit={handleCreateClub} />
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              All Clubs ({clubs.length})
            </h2>
            <div className="space-y-3">
              {clubs.map((club) => {
                const advisor = allUsers.find((u) => u.id === club.advisorId)
                  ?? (club.advisorId === actualUser.id ? actualUser : undefined)
                const advisorName = advisor?.name ?? advisorNames[club.advisorId] ?? 'Unassigned'
                const spotsLeft = club.capacity !== null ? club.capacity - club.memberIds.length : null
                return (
                  <Card key={club.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{club.iconUrl ?? '📌'}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{club.name}</p>
                            <p className="text-xs text-gray-500">
                              Advisor: {advisorName}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}
                          </div>
                          {club.capacity === null ? (
                            <Badge variant="secondary" className="text-xs">Unlimited</Badge>
                          ) : spotsLeft !== null && spotsLeft <= 0 ? (
                            <Badge variant="destructive" className="text-xs">Full</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">{spotsLeft} spots left</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>

        {/* Staff & roles */}
        <div className="border-t pt-8 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Staff & Role Management</h2>
              <p className="text-sm text-gray-500">
                Promote joined users to advisor so they can own clubs, manage rosters, and run attendance.
              </p>
            </div>
          </div>

          {roleError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4">{roleError}</p>
          )}

          {allUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No users have joined this school yet.</p>
          ) : (
            <div className="space-y-3">
              {allUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="py-4 px-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{user.name}</span>
                        <Badge variant="secondary" className="text-xs capitalize">{user.role}</Badge>
                        {user.id === actualUser.id && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">You</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {(['student', 'advisor', 'admin'] as Exclude<Role, 'superadmin'>[]).map((nextRole) => (
                        <Button
                          key={nextRole}
                          size="sm"
                          variant={user.role === nextRole ? 'default' : 'outline'}
                          className="h-8 text-xs capitalize"
                          disabled={updatingRoleId === user.id || user.role === nextRole}
                          onClick={() => updateUserRole(user.id, nextRole)}
                        >
                          {updatingRoleId === user.id ? 'Saving...' : nextRole}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Student Roster */}
        <div className="border-t pt-8 mb-10">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="w-5 h-5 text-green-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Student Roster</h2>
              <p className="text-sm text-gray-500">All enrolled students — click a name to view or edit their profile.</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Clubs</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allUsers.filter((u) => u.role === 'student').map(applyOverrides).map((student) => {
                  const studentClubIds = membershipsByUser[student.id] ?? []
                  const studentClubs = studentClubIds.map((cid) => clubs.find((c) => c.id === cid)).filter(Boolean) as Club[]
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/profile/${student.id}`} className="flex items-center gap-2 group">
                          <Avatar name={student.name} size="sm" />
                          <span className="font-medium text-gray-900 group-hover:text-blue-600 group-hover:underline">
                            {student.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{student.email}</td>
                      <td className="px-4 py-3">
                        {studentClubs.length === 0 ? (
                          <span className="text-gray-400 italic">No clubs</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {studentClubs.map((c) => (
                              <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
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
        </div>

        {/* School Elections section */}
        <div className="border-t pt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Vote className="w-5 h-5 text-purple-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">School-Wide Elections</h2>
                <p className="text-sm text-gray-500">All students and staff can vote on these positions.</p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setShowElectionForm((v) => !v)}
              className="flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Election
            </Button>
          </div>

          {/* Election creation form */}
          {showElectionForm && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Create New School Election</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Position Title *</label>
                  <Input
                    value={electionTitle}
                    onChange={(e) => setElectionTitle(e.target.value)}
                    placeholder="e.g. Student Body President"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Description</label>
                  <textarea
                    value={electionDescription}
                    onChange={(e) => setElectionDescription(e.target.value)}
                    placeholder="Brief description of the role…"
                    rows={2}
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    Candidates * (select 2+)
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={electionCandidateIds.includes(s.id)}
                          onChange={() => toggleElectionCandidate(s.id)}
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={createElection}
                    disabled={!electionTitle.trim() || electionCandidateIds.length < 2}
                  >
                    Launch Election
                  </Button>
                  <Button variant="outline" onClick={() => setShowElectionForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Election list */}
          {elections.length === 0 ? (
            <p className="text-sm text-gray-400">No school elections yet.</p>
          ) : (
            <div className="space-y-4">
              {elections.map((election) => {
                const totalVotes = election.candidates.reduce((s, c) => s + c.votes.length, 0)
                const winner = !election.isOpen
                  ? election.candidates.reduce((a, b) => (a.votes.length >= b.votes.length ? a : b))
                  : null

                return (
                  <Card key={election.id}>
                    <CardContent className="py-4 px-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{election.positionTitle}</p>
                          {election.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{election.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {election.isOpen ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>
                          )}
                          {election.isOpen && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => closeElection(election.id)}
                            >
                              Close Election
                            </Button>
                          )}
                        </div>
                      </div>

                      {winner && (
                        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mb-3">
                          Winner: {getUserById(winner.userId)?.name} ({winner.votes.length} votes)
                        </p>
                      )}

                      <div className="space-y-2">
                        {election.candidates.map((c) => {
                          const user = getUserById(c.userId)
                          const pct = totalVotes > 0 ? Math.round((c.votes.length / totalVotes) * 100) : 0
                          return (
                            <div key={c.userId} className="flex items-center gap-3">
                              <span className="text-sm text-gray-700 w-28 shrink-0">{user?.name}</span>
                              <div className="flex-1">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-purple-400 h-2 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs text-gray-400 w-20 text-right shrink-0">
                                {c.votes.length} votes {totalVotes > 0 && `(${pct}%)`}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Issue Reports section */}
        <div className="border-t pt-8 mt-4">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Issue Reports</h2>
              <p className="text-sm text-gray-500">Issues submitted by students and staff.</p>
            </div>
            {issueReports.filter((r) => r.status === 'open').length > 0 && (
              <span className="ml-auto text-xs font-bold bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                {issueReports.filter((r) => r.status === 'open').length} open
              </span>
            )}
          </div>

          {issueReports.length === 0 ? (
            <p className="text-sm text-gray-400">No issue reports yet.</p>
          ) : (
            <div className="space-y-3">
              {issueReports.map((report) => (
                <Card key={report.id} className={report.status === 'resolved' ? 'opacity-60' : ''}>
                  <CardContent className="py-4 px-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{report.reporter_name}</span>
                          <span className="text-xs text-gray-400">{report.reporter_email}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            report.status === 'open'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{report.message}</p>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      {report.status === 'open' && (
                        <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs gap-1.5" onClick={() => resolveIssue(report.id)}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
