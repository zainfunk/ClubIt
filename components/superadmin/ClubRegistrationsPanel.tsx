'use client'

import { useCallback, useEffect, useState } from 'react'
import { Inbox, RefreshCw, Mail, Check, X, Loader2, Users, AlertTriangle, Clock } from 'lucide-react'
import type { ClubRegistrationRequest } from '@/types'

// Superadmin reviewer queue for self-serve club registrations submitted through
// /join/<slug> (open-registration schools like UConn). Renders on /superadmin
// next to the leads inbox. Approve creates a real club owned by the requester;
// deny requires a reason.

interface ReviewRequest extends ClubRegistrationRequest {
  requesterName: string | null
  requesterEmail: string | null
  duplicateClubNames: string[]
}

type Filter = 'pending' | 'approved' | 'denied' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-600',
}

export default function ClubRegistrationsPanel() {
  const [requests, setRequests] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [denyingId, setDenyingId] = useState<string | null>(null)
  const [denyReason, setDenyReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/club-registrations')
      if (!res.ok) throw new Error('Failed to load registrations')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      setError('Could not load club registrations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function review(id: string, action: 'approve' | 'deny', reason?: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/club-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Failed to review the request')
        return
      }
      setDenyingId(null)
      setDenyReason('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const shown = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Club registrations</h2>
          {pendingCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">Self-serve club submissions from open-registration schools</p>

      <div className="flex gap-2 mb-4">
        {(['pending', 'approved', 'denied', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors capitalize ${
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 text-red-600 text-sm px-4 py-3 mb-3">{error}</div>
      )}

      {!error && loading && requests.length === 0 && (
        <div className="flex items-center gap-2 text-gray-400 text-sm px-1 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading registrations…
        </div>
      )}

      {!loading && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white text-center py-10">
          <Inbox className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {filter === 'all' ? 'No registrations yet.' : `No ${filter} registrations.`}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{r.clubName}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {r.status}
                  </span>
                  {r.category && <span className="text-xs text-gray-400">· {r.category}</span>}
                </div>
                <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-gray-500">
                  {typeof r.expectedMembers === 'number' && (
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />~{r.expectedMembers} members</span>
                  )}
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(r.createdAt)}</span>
                </div>
              </div>
              {r.status === 'pending' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Approve & create club"
                    onClick={() => review(r.id, 'approve')}
                    disabled={busyId === r.id}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                  >
                    {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    title="Deny"
                    onClick={() => { setDenyingId(denyingId === r.id ? null : r.id); setDenyReason('') }}
                    disabled={busyId === r.id}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 text-sm text-gray-600 whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-100 p-3">
              {r.description}
            </p>

            {r.duplicateClubNames.length > 0 && (
              <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Possible duplicate of existing club{r.duplicateClubNames.length > 1 ? 's' : ''}:{' '}
                  <span className="font-medium">{r.duplicateClubNames.join(', ')}</span>
                </span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
              <span className="text-gray-700 font-medium">{r.requesterName ?? 'Unknown'}</span>
              {r.requesterRole && <span className="text-gray-400 capitalize">· {r.requesterRole}</span>}
              {r.requesterEmail && (
                <a
                  href={`mailto:${r.requesterEmail}?subject=${encodeURIComponent(`Your ClubIt club registration: ${r.clubName}`)}`}
                  className="inline-flex items-center gap-1 text-[#0058be] hover:underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {r.requesterEmail}
                </a>
              )}
              {r.contactInfo && <span className="text-gray-400">· {r.contactInfo}</span>}
            </div>

            {r.status === 'denied' && r.denialReason && (
              <p className="mt-2 text-xs text-red-600"><span className="font-medium">Denial reason:</span> {r.denialReason}</p>
            )}

            {denyingId === r.id && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason for denial (required)</label>
                <textarea
                  rows={2}
                  value={denyReason}
                  maxLength={1000}
                  onChange={(e) => setDenyReason(e.target.value)}
                  placeholder="Let the student know why, and what to change."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => { setDenyingId(null); setDenyReason('') }}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => review(r.id, 'deny', denyReason.trim())}
                    disabled={busyId === r.id || !denyReason.trim()}
                    className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 disabled:opacity-40"
                  >
                    {busyId === r.id ? 'Denying…' : 'Confirm denial'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}
