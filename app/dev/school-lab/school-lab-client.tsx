'use client'

import { useEffect, useState } from 'react'
import { Copy, FlaskConical, Link as LinkIcon, RefreshCw } from 'lucide-react'
import { useMockAuth } from '@/lib/mock-auth'

interface Snapshot {
  currentRole: string
  school: {
    id: string
    name: string
    status: 'pending' | 'active' | 'suspended'
    studentInviteCode: string | null
    adminInviteCode: string | null
    setupLink: string | null
    setupTokenExpiresAt: string | null
    setupCompletedAt: string | null
  } | null
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  active: 'bg-green-50 text-green-700',
  suspended: 'bg-red-50 text-red-700',
}

function CopyTextButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      <Copy className="w-3.5 h-3.5" />
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function SchoolLabClient() {
  const { actualUser, currentUser, schoolName, schoolStatus, refreshSchoolContext } = useMockAuth()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [newSchoolName, setNewSchoolName] = useState('Dev Test School')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function loadSnapshot() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dev/school-lab', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load school lab')
      setSnapshot(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load school lab')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshot()
  }, [])

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setWorking(action)
    setError(null)

    try {
      const res = await fetch('/api/dev/school-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Action failed')

      setSnapshot(data)
      refreshSchoolContext()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setWorking(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0058be] mb-2">
            <FlaskConical className="w-4 h-4" />
            Development Only
          </div>
          <h1 className="text-2xl font-bold text-gray-900">School Lab</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Create or mutate a test school without touching the production onboarding path.
            Use this to exercise setup links, invite codes, suspension, and reactivation while we harden the real lifecycle.
          </p>
        </div>
        <button
          onClick={() => void loadSnapshot()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Current Session</h2>
          <div className="space-y-3 text-sm">
            <p className="text-gray-500">
              Signed in as <span className="font-medium text-gray-900">{currentUser.name}</span>
            </p>
            <p className="text-gray-500">
              Saved role <span className="font-medium text-gray-900">{snapshot?.currentRole ?? actualUser.role}</span>
            </p>
            <p className="text-gray-500">
              Preview role <span className="font-medium text-gray-900">{currentUser.role}</span>
            </p>
            <p className="text-gray-500">
              School <span className="font-medium text-gray-900">{schoolName ?? 'None yet'}</span>
            </p>
            <p className="text-gray-500">
              Lifecycle status <span className="font-medium text-gray-900">{schoolStatus ?? 'No school'}</span>
            </p>
            {snapshot?.school && (
              <div className="pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Set my saved role</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void runAction('set_my_role', { status: 'admin' })}
                    disabled={working !== null}
                    className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Make me admin
                  </button>
                  <button
                    onClick={() => void runAction('set_my_role', { status: 'advisor' })}
                    disabled={working !== null}
                    className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Make me advisor
                  </button>
                  <button
                    onClick={() => void runAction('set_my_role', { status: 'student' })}
                    disabled={working !== null}
                    className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Make me student
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Suggested Test Flow</h2>
          <ol className="space-y-2 text-sm text-gray-600">
            <li>1. Create a dev school or reactivate the current one.</li>
            <li>2. Open the setup link in another tab and verify the codes render publicly.</li>
            <li>3. Join with the student and admin codes in separate accounts.</li>
            <li>4. Promote one joined user to advisor from the Admin page.</li>
            <li>5. Create a club, then suspend and reactivate the school to confirm gating.</li>
          </ol>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-400">
          Loading school lab...
        </div>
      ) : !snapshot?.school ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create a test school</h2>
            <p className="text-sm text-gray-500 mt-1">
              This will attach your current account to a fresh active school and make you that school&apos;s admin.
            </p>
          </div>
          <input
            value={newSchoolName}
            onChange={(e) => setNewSchoolName(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            placeholder="Dev Test School"
          />
          <button
            onClick={() => void runAction('create_test_school', { name: newSchoolName })}
            disabled={working !== null || !newSchoolName.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {working === 'create_test_school' ? 'Creating...' : 'Create test school'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">School Snapshot</p>
                <h2 className="text-xl font-bold text-gray-900">{snapshot.school.name}</h2>
                <p className="text-sm text-gray-500 mt-1 font-mono break-all">{snapshot.school.id}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[snapshot.school.status]}`}>
                {snapshot.school.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Student code</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-sm font-mono font-bold text-gray-900">
                    {snapshot.school.studentInviteCode ?? 'Not generated'}
                  </code>
                  {snapshot.school.studentInviteCode && <CopyTextButton value={snapshot.school.studentInviteCode} />}
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Admin code</p>
                <div className="flex items-center justify-between gap-3">
                  <code className="text-sm font-mono font-bold text-gray-900">
                    {snapshot.school.adminInviteCode ?? 'Not generated'}
                  </code>
                  {snapshot.school.adminInviteCode && <CopyTextButton value={snapshot.school.adminInviteCode} />}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mt-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Setup link</p>
                  <p className="text-sm text-gray-700 font-mono break-all">
                    {snapshot.school.setupLink ? `${origin}${snapshot.school.setupLink}` : 'Not generated'}
                  </p>
                </div>
                {snapshot.school.setupLink && <CopyTextButton value={`${origin}${snapshot.school.setupLink}`} />}
              </div>
              {snapshot.school.setupTokenExpiresAt && (
                <p className="text-xs text-gray-400 mt-2">
                  Expires {new Date(snapshot.school.setupTokenExpiresAt).toLocaleString('en-US')}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Lifecycle Actions</h2>
              <p className="text-sm text-gray-500 mt-1">
                These actions update your current school directly in Supabase, but only in local development.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void runAction('set_status', { status: 'pending' })}
                disabled={working !== null}
                className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                Mark pending
              </button>
              <button
                onClick={() => void runAction('set_status', { status: 'active' })}
                disabled={working !== null}
                className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
              >
                Mark active
              </button>
              <button
                onClick={() => void runAction('set_status', { status: 'suspended' })}
                disabled={working !== null}
                className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Mark suspended
              </button>
              <button
                onClick={() => void runAction('regenerate_codes')}
                disabled={working !== null}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Regenerate codes
              </button>
              <button
                onClick={() => void runAction('generate_setup_link')}
                disabled={working !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <LinkIcon className="w-4 h-4" />
                New setup link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
