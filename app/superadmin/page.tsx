'use client'

import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  CheckCircle, XCircle, Ban, RefreshCw, Link, Clock,
  School, ChevronDown, Copy, ExternalLink, Plus, X, Mail,
  Users, BookOpen, Activity, Server, Globe, Shield,
  BarChart3, AlertTriangle, Eye, Settings, Bug, MessageSquare,
  Calendar, ArrowRight, ChevronRight, Search, Loader2,
  Trash2, Pencil, Save,
} from 'lucide-react'
import { School as SchoolType } from '@/types'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Filter = 'all' | 'pending' | 'active' | 'suspended'

type DetailTab = 'overview' | 'users' | 'clubs' | 'activity' | 'issues' | 'debug'

interface SchoolDetailData {
  school: SchoolType
  stats: {
    totalUsers: number
    studentCount: number
    advisorCount: number
    adminCount: number
    clubCount: number
    totalMessages: number
    totalEvents: number
    totalMemberships: number
    openIssueReports: number
    activeElections: number
  }
  users: Array<{ id: string; name: string; email: string; role: string }>
  clubs: Array<{
    id: string; name: string; description: string
    advisor_id: string; member_count: number; created_at: string
  }>
  recentActivity: Array<{ type: string; description: string; timestamp: string }>
  issueReports: Array<{
    id: string; reporter_name: string; message: string
    status: string; created_at: string
  }>
  settings: Record<string, unknown> | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-red-50 text-red-700',
}

const COLOR_MAP = {
  green: 'bg-green-50 text-green-700 hover:bg-green-100',
  red: 'bg-red-50 text-red-700 hover:bg-red-100',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
}

const DETAIL_TABS: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { key: 'clubs', label: 'Clubs', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  { key: 'issues', label: 'Issues', icon: <AlertTriangle className="w-4 h-4" /> },
  { key: 'debug', label: 'Debug', icon: <Bug className="w-4 h-4" /> },
]

/* ------------------------------------------------------------------ */
/*  Shared small components                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="ml-1 text-gray-400 hover:text-gray-700 transition-colors">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

interface ActionButtonProps {
  label: string
  icon: React.ReactNode
  color: 'green' | 'red' | 'blue' | 'gray'
  loading: boolean
  onClick: () => void
}

function ActionButton({ label, icon, color, loading, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${COLOR_MAP[color]}`}
    >
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  )
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: string | number; icon: React.ReactNode; accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ?? 'bg-gray-100'}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
}

/* ------------------------------------------------------------------ */
/*  InviteModal                                                        */
/* ------------------------------------------------------------------ */

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const text = await res.text()
      let data: Record<string, string> = {}
      try { data = JSON.parse(text) } catch { /* empty response */ }
      if (!res.ok) throw new Error(data.error ?? `Server error (${res.status})`)
      setInviteUrl(`${window.location.origin}${data.inviteUrl}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const mailtoLink = inviteUrl
    ? `mailto:${email}?subject=${encodeURIComponent('Set up your school on Clubit')}&body=${encodeURIComponent(`Hi,\n\nYou've been invited to set up your school on Clubit.\n\nClick the link below to get started:\n${inviteUrl}\n\nThis link is for your school only — please don't share it.\n\nClubIt Team`)}`
    : ''

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Invite a school</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={generate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="principal@school.edu"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Development-only shortcut. This bypasses the normal onboarding review flow so you can test a full school setup quickly.
              </p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generating...' : 'Generate invite link'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">Invite link for <span className="font-medium text-gray-700">{email}</span></p>
              <p className="text-xs font-mono text-gray-700 break-all leading-relaxed">{inviteUrl}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href={mailtoLink}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Open in email
              </a>
            </div>
            <p className="text-xs text-gray-400 text-center">Single-use development link only.</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SchoolDetailModal                                                  */
/* ------------------------------------------------------------------ */

function SchoolDetailModal({
  schoolId,
  onClose,
  onSchoolAction,
}: {
  schoolId: string
  onClose: () => void
  onSchoolAction: () => void
}) {
  const [data, setData] = useState<SchoolDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<DetailTab>('overview')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [roleChanging, setRoleChanging] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState('')

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}/detail`)
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school details')
    } finally {
      setLoading(false)
    }
  }, [schoolId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  async function schoolAction(path: string, label: string) {
    setActionLoading(label)
    try {
      const res = await fetch(path, { method: 'POST' })
      if (!res.ok) throw new Error('Action failed')
      onSchoolAction()
      await fetchDetail()
    } finally {
      setActionLoading(null)
    }
  }

  async function changeUserRole(userId: string, newRole: string) {
    setRoleChanging(userId)
    try {
      const res = await fetch(`/api/school/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('Failed to change role')
      await fetchDetail()
    } finally {
      setRoleChanging(null)
    }
  }

  async function resolveIssue(issueId: string) {
    setActionLoading(`resolve-${issueId}`)
    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}/issues/${issueId}/resolve`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to resolve')
      await fetchDetail()
    } finally {
      setActionLoading(null)
    }
  }

  const school = data?.school
  const stats = data?.stats

  const filteredUsers = data?.users.filter(u =>
    !userSearch ||
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  ) ?? []

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0058be]/10 rounded-xl flex items-center justify-center">
              <School className="w-4 h-4 text-[#0058be]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {loading ? 'Loading...' : school?.name ?? 'School Details'}
              </h2>
              {school && (
                <p className="text-xs text-gray-400">{school.district ?? 'No district'} / {school.contactEmail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {school && <StatusBadge status={school.status} />}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-gray-600">{error}</p>
            <button onClick={fetchDetail} className="text-sm text-[#0058be] hover:underline">Try again</button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 pb-0 border-b border-gray-100 shrink-0 overflow-x-auto">
              {DETAIL_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-t-lg transition-colors whitespace-nowrap ${
                    tab === t.key
                      ? 'text-[#0058be] border-b-2 border-[#0058be] font-medium -mb-px'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ---- Overview ---- */}
              {tab === 'overview' && school && stats && (
                <div className="space-y-6">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Total Users" value={stats.totalUsers} icon={<Users className="w-4 h-4 text-[#0058be]" />} accent="bg-[#0058be]/10" />
                    <StatCard label="Clubs" value={stats.clubCount} icon={<BookOpen className="w-4 h-4 text-purple-600" />} accent="bg-purple-50" />
                    <StatCard label="Messages" value={stats.totalMessages} icon={<MessageSquare className="w-4 h-4 text-green-600" />} accent="bg-green-50" />
                    <StatCard label="Events" value={stats.totalEvents} icon={<Calendar className="w-4 h-4 text-amber-600" />} accent="bg-amber-50" />
                  </div>

                  {/* User breakdown */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-gray-500 mb-3">User Breakdown</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{stats.studentCount}</p>
                        <p className="text-xs text-gray-400">Students</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{stats.advisorCount}</p>
                        <p className="text-xs text-gray-400">Advisors</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-gray-900">{stats.adminCount}</p>
                        <p className="text-xs text-gray-400">Admins</p>
                      </div>
                    </div>
                  </div>

                  {/* More stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-lg font-bold text-gray-900">{stats.totalMemberships}</p>
                      <p className="text-xs text-gray-400">Memberships</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-lg font-bold text-gray-900">{stats.openIssueReports}</p>
                      <p className="text-xs text-gray-400">Open Issues</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-lg font-bold text-gray-900">{stats.activeElections}</p>
                      <p className="text-xs text-gray-400">Active Elections</p>
                    </div>
                  </div>

                  {/* School info */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-medium text-gray-500 mb-3">School Info</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-400">Contact:</span> <span className="text-gray-700">{school.contactName}</span></div>
                      <div><span className="text-gray-400">Email:</span> <span className="text-gray-700">{school.contactEmail}</span></div>
                      <div><span className="text-gray-400">District:</span> <span className="text-gray-700">{school.district ?? 'N/A'}</span></div>
                      <div><span className="text-gray-400">Created:</span> <span className="text-gray-700">{new Date(school.createdAt).toLocaleDateString()}</span></div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-3">Quick Actions</p>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        label="Regen codes"
                        icon={<RefreshCw className="w-3.5 h-3.5" />}
                        color="gray"
                        loading={actionLoading === 'regen'}
                        onClick={() => schoolAction(`/api/superadmin/schools/${schoolId}/regenerate-codes`, 'regen')}
                      />
                      {school.status === 'active' && (
                        <ActionButton
                          label="Suspend school"
                          icon={<Ban className="w-3.5 h-3.5" />}
                          color="red"
                          loading={actionLoading === 'suspend'}
                          onClick={() => schoolAction(`/api/superadmin/schools/${schoolId}/suspend`, 'suspend')}
                        />
                      )}
                      {school.status === 'suspended' && (
                        <ActionButton
                          label="Reactivate school"
                          icon={<CheckCircle className="w-3.5 h-3.5" />}
                          color="green"
                          loading={actionLoading === 'reactivate'}
                          onClick={() => schoolAction(`/api/superadmin/schools/${schoolId}/suspend`, 'reactivate')}
                        />
                      )}
                      {school.status === 'pending' && (
                        <>
                          <ActionButton
                            label="Approve"
                            icon={<CheckCircle className="w-3.5 h-3.5" />}
                            color="green"
                            loading={actionLoading === 'approve'}
                            onClick={() => schoolAction(`/api/superadmin/schools/${schoolId}/approve`, 'approve')}
                          />
                          <ActionButton
                            label="Reject"
                            icon={<XCircle className="w-3.5 h-3.5" />}
                            color="red"
                            loading={actionLoading === 'reject'}
                            onClick={() => schoolAction(`/api/superadmin/schools/${schoolId}/reject`, 'reject')}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Users ---- */}
              {tab === 'users' && (
                <div className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users by name or email..."
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 focus:border-[#0058be]"
                    />
                  </div>

                  <p className="text-xs text-gray-400">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</p>

                  {/* User table */}
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left">
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Email</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500">Role</th>
                          <th className="px-4 py-2.5 text-xs font-medium text-gray-500 w-40">Change Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredUsers.map(user => (
                          <tr key={user.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                            <td className="px-4 py-3 text-gray-500">{user.email}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                                user.role === 'admin' ? 'bg-purple-50 text-purple-700' :
                                user.role === 'advisor' ? 'bg-blue-50 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <select
                                  disabled={roleChanging === user.id}
                                  defaultValue={user.role}
                                  onChange={e => changeUserRole(user.id, e.target.value)}
                                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0058be]/20 disabled:opacity-50"
                                >
                                  <option value="student">Student</option>
                                  <option value="advisor">Advisor</option>
                                  <option value="admin">Admin</option>
                                </select>
                                {roleChanging === user.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-gray-400 text-sm">
                              {userSearch ? 'No users match your search' : 'No users in this school'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ---- Clubs ---- */}
              {tab === 'clubs' && (
                <div className="space-y-3">
                  {data?.clubs.length === 0 && (
                    <p className="text-center py-12 text-gray-400 text-sm">No clubs yet</p>
                  )}
                  {data?.clubs.map(club => (
                    <div key={club.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{club.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{club.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {club.member_count}
                          </span>
                          <span>{new Date(club.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {club.advisor_id && (
                        <p className="text-xs text-gray-400 mt-2">
                          Advisor: <span className="text-gray-600">
                            {data?.users.find(u => u.id === club.advisor_id)?.name ?? club.advisor_id}
                          </span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ---- Activity ---- */}
              {tab === 'activity' && (
                <div className="space-y-3">
                  {(!data?.recentActivity || data.recentActivity.length === 0) && (
                    <p className="text-center py-12 text-gray-400 text-sm">No recent activity</p>
                  )}
                  {data?.recentActivity.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === 'message' ? 'bg-blue-50' :
                        item.type === 'event' ? 'bg-amber-50' :
                        item.type === 'join_request' ? 'bg-green-50' :
                        'bg-gray-100'
                      }`}>
                        {item.type === 'message' ? <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> :
                         item.type === 'event' ? <Calendar className="w-3.5 h-3.5 text-amber-600" /> :
                         <Activity className="w-3.5 h-3.5 text-gray-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{item.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ---- Issues ---- */}
              {tab === 'issues' && (
                <div className="space-y-3">
                  {(!data?.issueReports || data.issueReports.length === 0) && (
                    <p className="text-center py-12 text-gray-400 text-sm">No issue reports</p>
                  )}
                  {data?.issueReports.map(issue => (
                    <div key={issue.id} className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">{issue.reporter_name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                              issue.status === 'open' ? 'bg-red-50 text-red-600' :
                              issue.status === 'resolved' ? 'bg-green-50 text-green-600' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {issue.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{issue.message}</p>
                          <p className="text-xs text-gray-400 mt-1.5">{new Date(issue.created_at).toLocaleString()}</p>
                        </div>
                        {issue.status === 'open' && (
                          <button
                            onClick={() => resolveIssue(issue.id)}
                            disabled={actionLoading === `resolve-${issue.id}`}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 shrink-0"
                          >
                            {actionLoading === `resolve-${issue.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ---- Debug ---- */}
              {tab === 'debug' && school && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">School Object</p>
                    <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(school, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Invite Codes</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(['studentInviteCode', 'advisorInviteCode', 'adminInviteCode'] as const).map(key => (
                        <div key={key} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 mb-1">{key.replace('InviteCode', '')}</p>
                          <div className="flex items-center">
                            <code className="text-sm font-mono font-bold text-gray-800">{school[key] ?? 'N/A'}</code>
                            {school[key] && <CopyButton value={school[key]!} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Setup Status</p>
                    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                      <p><span className="text-gray-400">Setup token:</span> <code className="text-xs font-mono">{school.setupToken ?? 'N/A'}</code></p>
                      <p><span className="text-gray-400">Token expires:</span> {school.setupTokenExpiresAt ? new Date(school.setupTokenExpiresAt).toLocaleString() : 'N/A'}</p>
                      <p><span className="text-gray-400">Setup completed:</span> {school.setupCompletedAt ? new Date(school.setupCompletedAt).toLocaleString() : 'Not yet'}</p>
                    </div>
                  </div>

                  {data?.settings && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Settings</p>
                      <pre className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(data.settings, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SchoolRow                                                          */
/* ------------------------------------------------------------------ */

interface SchoolRowProps {
  school: SchoolType
  onAction: () => void
  onViewDetails: (id: string) => void
}

function SchoolRow({ school, onAction, onViewDetails }: SchoolRowProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [setupLink, setSetupLink] = useState<string | null>(null)
  const [codes, setCodes] = useState({
    student: school.studentInviteCode,
    advisor: school.advisorInviteCode,
    admin: school.adminInviteCode,
  })

  // Rename state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(school.name)
  const [editDistrict, setEditDistrict] = useState(school.district ?? '')

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  async function call(path: string, label: string) {
    setLoading(label)
    try {
      const res = await fetch(path, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) return
      if (data.setupLink) setSetupLink(data.setupLink)
      if (data.studentInviteCode) setCodes({ student: data.studentInviteCode, advisor: data.advisorInviteCode ?? null, admin: data.adminInviteCode })
      onAction()
    } finally {
      setLoading(null)
    }
  }

  async function saveRename() {
    if (!editName.trim()) return
    setLoading('rename')
    try {
      const res = await fetch(`/api/superadmin/schools/${school.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), district: editDistrict.trim() }),
      })
      if (res.ok) {
        setEditing(false)
        onAction()
      }
    } finally {
      setLoading(null)
    }
  }

  async function deleteSchool() {
    setLoading('delete')
    try {
      const res = await fetch(`/api/superadmin/schools/${school.id}`, { method: 'DELETE' })
      if (res.ok) {
        setShowDeleteConfirm(false)
        onAction()
      }
    } finally {
      setLoading(null)
    }
  }

  const createdAt = new Date(school.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Row header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
            <School className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{school.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{school.district ?? '\u2014'} / {school.contactEmail}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={school.status} />
          <span className="text-xs text-gray-400 hidden sm:block">{createdAt}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-gray-100 p-5 space-y-5">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Contact</p>
              <p className="font-medium text-gray-800">{school.contactName}</p>
              <p className="text-gray-500">{school.contactEmail}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">School ID</p>
              <p className="font-mono text-xs text-gray-500 break-all">{school.id}</p>
            </div>
          </div>

          {/* Invite codes (only for active schools) */}
          {(codes.student || codes.advisor || codes.admin) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Student code</p>
                <div className="flex items-center">
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.student ?? '\u2014'}</code>
                  {codes.student && <CopyButton value={codes.student} />}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Advisor code</p>
                <div className="flex items-center">
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.advisor ?? '\u2014'}</code>
                  {codes.advisor && <CopyButton value={codes.advisor} />}
                </div>
                {!codes.advisor && (
                  <p className="text-xs text-gray-400 mt-1">Regen codes to generate</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Admin code</p>
                <div className="flex items-center">
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.admin ?? '\u2014'}</code>
                  {codes.admin && <CopyButton value={codes.admin} />}
                </div>
              </div>
            </div>
          )}

          {/* Setup link */}
          {setupLink && (
            <div className="bg-blue-50 rounded-xl p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-blue-700 font-mono break-all">{window.location.origin}{setupLink}</p>
              <div className="flex gap-2 shrink-0">
                <CopyButton value={`${window.location.origin}${setupLink}`} />
                <a href={setupLink} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Rename form */}
          {editing && (
            <div className="bg-blue-50/50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Edit School Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">School Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">District</label>
                  <input
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    placeholder="Optional"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveRename}
                  disabled={loading === 'rename' || !editName.trim()}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0058be] text-white hover:bg-[#0047a0] disabled:opacity-50 transition-colors"
                >
                  {loading === 'rename' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(school.name); setEditDistrict(school.district ?? '') }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="bg-red-50 rounded-xl p-4 space-y-3 border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Delete {school.name}?</p>
                  <p className="text-xs text-red-600 mt-1">
                    This will permanently remove the school, unlink all users, and delete all clubs, messages, events, and data. This cannot be undone.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs text-red-700 mb-1 block">
                  Type <span className="font-mono font-bold">{school.name}</span> to confirm
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={school.name}
                  className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={deleteSchool}
                  disabled={deleteConfirmText !== school.name || loading === 'delete'}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete Permanently
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {/* View Details button */}
            <button
              onClick={() => onViewDetails(school.id)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0058be]/10 text-[#0058be] hover:bg-[#0058be]/20 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Details
            </button>

            {/* Rename button */}
            <ActionButton
              label="Rename"
              icon={<Pencil className="w-3.5 h-3.5" />}
              color="gray"
              loading={false}
              onClick={() => { setEditing(!editing); setShowDeleteConfirm(false) }}
            />

            {school.status === 'pending' && (
              <>
                <ActionButton
                  label="Approve"
                  icon={<CheckCircle className="w-3.5 h-3.5" />}
                  color="green"
                  loading={loading === 'approve'}
                  onClick={() => call(`/api/superadmin/schools/${school.id}/approve`, 'approve')}
                />
                <ActionButton
                  label="Reject"
                  icon={<XCircle className="w-3.5 h-3.5" />}
                  color="red"
                  loading={loading === 'reject'}
                  onClick={() => call(`/api/superadmin/schools/${school.id}/reject`, 'reject')}
                />
              </>
            )}

            {school.status === 'active' && (
              <>
                <ActionButton
                  label="New setup link"
                  icon={<Link className="w-3.5 h-3.5" />}
                  color="blue"
                  loading={loading === 'setup-link'}
                  onClick={() => call(`/api/superadmin/schools/${school.id}/setup-link`, 'setup-link')}
                />
                <ActionButton
                  label="Regen codes"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  color="gray"
                  loading={loading === 'regen'}
                  onClick={() => call(`/api/superadmin/schools/${school.id}/regenerate-codes`, 'regen')}
                />
                <ActionButton
                  label="Suspend"
                  icon={<Ban className="w-3.5 h-3.5" />}
                  color="red"
                  loading={loading === 'suspend'}
                  onClick={() => call(`/api/superadmin/schools/${school.id}/suspend`, 'suspend')}
                />
              </>
            )}

            {school.status === 'suspended' && (
              <ActionButton
                label="Reactivate"
                icon={<CheckCircle className="w-3.5 h-3.5" />}
                color="green"
                loading={loading === 'reactivate'}
                onClick={() => call(`/api/superadmin/schools/${school.id}/suspend`, 'reactivate')}
              />
            )}

            {/* Delete button — always available */}
            <ActionButton
              label="Delete"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              color="red"
              loading={false}
              onClick={() => { setShowDeleteConfirm(!showDeleteConfirm); setEditing(false) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  ServerStatusPanel                                                  */
/* ------------------------------------------------------------------ */

function ServerStatusPanel() {
  const isDev = process.env.NODE_ENV === 'development'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Server Status</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">Environment</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isDev ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
          }`}>
            {isDev ? 'Development' : 'Production'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Status</p>
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Operational
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Version</p>
          <span className="text-xs text-gray-700 font-mono">1.0.0</span>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Quick Links</p>
          <div className="flex gap-2">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-xs text-[#0058be] hover:underline flex items-center gap-0.5">
              Supabase <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="text-xs text-[#0058be] hover:underline flex items-center gap-0.5">
              Clerk <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="text-xs text-[#0058be] hover:underline flex items-center gap-0.5">
              Vercel <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SuperAdminPage() {
  const devQuickInviteEnabled = process.env.NODE_ENV === 'development'
  const { isLoaded } = useUser()
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [detailSchoolId, setDetailSchoolId] = useState<string | null>(null)

  async function loadSchools() {
    setLoading(true)
    try {
      const res = await fetch('/api/superadmin/schools')
      const data = await res.json()
      setSchools(data.schools ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoaded) return

    let cancelled = false

    async function loadSchoolsForPage() {
      const res = await fetch('/api/superadmin/schools')
      const data = await res.json()
      if (cancelled) return
      setSchools(data.schools ?? [])
      setLoading(false)
    }

    void loadSchoolsForPage()

    return () => { cancelled = true }
  }, [isLoaded])

  const filtered = filter === 'all' ? schools : schools.filter(s => s.status === filter)

  const counts = {
    all: schools.length,
    pending: schools.filter(s => s.status === 'pending').length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
  }

  // Aggregate stats for the dashboard
  const totalSchools = schools.length
  const activeSchools = counts.active

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#f8f9fa]" />
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Modals */}
      {devQuickInviteEnabled && showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      {detailSchoolId && (
        <SchoolDetailModal
          schoolId={detailSchoolId}
          onClose={() => setDetailSchoolId(null)}
          onSchoolAction={loadSchools}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage all Clubit tenants and monitor platform health</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSchools}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {devQuickInviteEnabled && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Quick invite (Dev)
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Schools"
          value={totalSchools}
          icon={<School className="w-4 h-4 text-[#0058be]" />}
          accent="bg-[#0058be]/10"
        />
        <StatCard
          label="Active Schools"
          value={activeSchools}
          icon={<CheckCircle className="w-4 h-4 text-green-600" />}
          accent="bg-green-50"
        />
        <StatCard
          label="Pending Approval"
          value={counts.pending}
          icon={<Clock className="w-4 h-4 text-amber-600" />}
          accent="bg-amber-50"
        />
        <StatCard
          label="Suspended"
          value={counts.suspended}
          icon={<Ban className="w-4 h-4 text-red-500" />}
          accent="bg-red-50"
        />
      </div>

      {/* Server Status */}
      <div className="mb-6">
        <ServerStatusPanel />
      </div>

      {/* School Management Section */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Schools</h2>
        <p className="text-sm text-gray-400">Manage and inspect individual schools</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'active', 'suspended'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f === 'pending' && <Clock className="w-3.5 h-3.5" />}
            {f} <span className="text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* School list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm">
          <Spinner />
          Loading schools...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <School className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No schools in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(school => (
            <SchoolRow
              key={school.id}
              school={school}
              onAction={loadSchools}
              onViewDetails={setDetailSchoolId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
