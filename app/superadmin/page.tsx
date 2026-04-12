'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  CheckCircle, XCircle, Ban, RefreshCw, Link, Clock,
  School, ChevronDown, Copy, ExternalLink, Plus, X, Mail,
} from 'lucide-react'
import { School as SchoolType } from '@/types'

type Filter = 'all' | 'pending' | 'active' | 'suspended'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-red-50 text-red-700',
}

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

interface SchoolRowProps {
  school: SchoolType
  onAction: () => void
}

function SchoolRow({ school, onAction }: SchoolRowProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [setupLink, setSetupLink] = useState<string | null>(null)
  const [codes, setCodes] = useState({
    student: school.studentInviteCode,
    advisor: school.advisorInviteCode,
    admin: school.adminInviteCode,
  })

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
            <p className="text-xs text-gray-400 mt-0.5">{school.district ?? '—'} · {school.contactEmail}</p>
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
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.student ?? '—'}</code>
                  {codes.student && <CopyButton value={codes.student} />}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Advisor code</p>
                <div className="flex items-center">
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.advisor ?? '—'}</code>
                  {codes.advisor && <CopyButton value={codes.advisor} />}
                </div>
                {!codes.advisor && (
                  <p className="text-xs text-gray-400 mt-1">Regen codes to generate</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Admin code</p>
                <div className="flex items-center">
                  <code className="text-sm font-mono font-bold text-gray-800">{codes.admin ?? '—'}</code>
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

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
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
          </div>
        </div>
      )}
    </div>
  )
}

interface ActionButtonProps {
  label: string
  icon: React.ReactNode
  color: 'green' | 'red' | 'blue' | 'gray'
  loading: boolean
  onClick: () => void
}

const COLOR_MAP = {
  green: 'bg-green-50 text-green-700 hover:bg-green-100',
  red: 'bg-red-50 text-red-700 hover:bg-red-100',
  blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  gray: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
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

  async function copy() {
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
              {loading ? 'Generating…' : 'Generate invite link'}
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
                onClick={copy}
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

            <p className="text-xs text-gray-400 text-center">
              Single-use development link only.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const devQuickInviteEnabled = process.env.NODE_ENV === 'development'
  const { isLoaded } = useUser()
  const [schools, setSchools] = useState<SchoolType[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  // Access is gated server-side in app/superadmin/layout.tsx (DB-first check).

  async function loadSchools() {
    setLoading(true)
    const res = await fetch('/api/superadmin/schools')
    const data = await res.json()
    setSchools(data.schools ?? [])
    setLoading(false)
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

    return () => {
      cancelled = true
    }
  }, [isLoaded])

  const filtered = filter === 'all' ? schools : schools.filter(s => s.status === filter)

  const counts = {
    all: schools.length,
    pending: schools.filter(s => s.status === 'pending').length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
  }

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#f8f9fa]" />
  }

  return (
    <div className="max-w-3xl mx-auto">
      {devQuickInviteEnabled && showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage all Clubit tenants</p>
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
        <div className="text-center py-16 text-gray-400 text-sm">Loading schools…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No schools in this category</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(school => (
            <SchoolRow key={school.id} school={school} onAction={loadSchools} />
          ))}
        </div>
      )}
    </div>
  )
}
