'use client'

import { useCallback, useEffect, useState } from 'react'
import { Inbox, RefreshCw, Mail, Trash2, Check, Archive, Loader2, MapPin, Users } from 'lucide-react'

// Superadmin inbox for marketing sales inquiries submitted through /contact.
// Self-contained: fetches from /api/superadmin/contact-requests and renders on
// the main /superadmin page so new leads are visible where schools are managed.

interface ContactRequest {
  id: string
  created_at: string
  name: string
  email: string
  school_name: string
  district: string | null
  role: string | null
  student_count: number | null
  message: string | null
  status: 'new' | 'contacted' | 'archived' | string
}

type Filter = 'all' | 'new' | 'contacted' | 'archived'

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-amber-100 text-amber-700',
  contacted: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ContactRequestsPanel() {
  const [requests, setRequests] = useState<ContactRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/contact-requests')
      if (!res.ok) throw new Error('Failed to load leads')
      const data = await res.json()
      setRequests(data.requests ?? [])
    } catch {
      setError('Could not load leads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id: string, status: ContactRequest['status']) {
    setBusyId(id)
    try {
      const res = await fetch('/api/superadmin/contact-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
      }
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      const res = await fetch('/api/superadmin/contact-requests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setRequests((rs) => rs.filter((r) => r.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const newCount = requests.filter((r) => r.status === 'new').length
  const shown = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Leads</h2>
          {newCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {newCount} new
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
      <p className="text-sm text-gray-400 mb-4">Sales inquiries from the marketing contact form</p>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'new', 'contacted', 'archived'] as Filter[]).map((f) => (
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
        <div className="rounded-xl border border-red-100 bg-red-50 text-red-600 text-sm px-4 py-3">{error}</div>
      )}

      {!error && loading && requests.length === 0 && (
        <div className="flex items-center gap-2 text-gray-400 text-sm px-1 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading leads…
        </div>
      )}

      {!error && !loading && shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white text-center py-10">
          <Inbox className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            {filter === 'all' ? 'No leads yet.' : `No ${filter} leads.`}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {shown.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${
              r.status === 'archived' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{r.school_name}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-gray-500">
                  {r.district && (
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{r.district}</span>
                  )}
                  {typeof r.student_count === 'number' && (
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{r.student_count} students</span>
                  )}
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.status !== 'contacted' && (
                  <IconBtn title="Mark contacted" onClick={() => setStatus(r.id, 'contacted')} busy={busyId === r.id}>
                    <Check className="w-4 h-4" />
                  </IconBtn>
                )}
                {r.status !== 'archived' && (
                  <IconBtn title="Archive" onClick={() => setStatus(r.id, 'archived')} busy={busyId === r.id}>
                    <Archive className="w-4 h-4" />
                  </IconBtn>
                )}
                <IconBtn title="Delete" onClick={() => remove(r.id)} busy={busyId === r.id} danger>
                  <Trash2 className="w-4 h-4" />
                </IconBtn>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
              <span className="text-gray-700 font-medium">{r.name}</span>
              {r.role && <span className="text-gray-400">· {r.role}</span>}
              <a
                href={`mailto:${r.email}?subject=${encodeURIComponent(`ClubIt for ${r.school_name}`)}`}
                className="inline-flex items-center gap-1 text-[#0058be] hover:underline"
              >
                <Mail className="w-3.5 h-3.5" />
                {r.email}
              </a>
            </div>

            {r.message && (
              <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap rounded-lg bg-gray-50 border border-gray-100 p-3">
                {r.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function IconBtn({
  children,
  title,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  busy?: boolean
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 transition-colors disabled:opacity-40 ${
        danger ? 'text-red-500 hover:bg-red-50 hover:border-red-200' : 'text-gray-500 hover:bg-gray-50 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}
