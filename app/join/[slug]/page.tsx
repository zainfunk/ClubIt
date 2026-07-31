'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser, useClerk } from '@clerk/nextjs'
import { GraduationCap, CheckCircle, Clock, XCircle, LogOut } from 'lucide-react'
import type { ClubRegistrationRequest, RequesterRole } from '@/types'

interface SchoolInfo {
  name: string
  slug: string | null
  allowedEmailDomain: string | null
  status: string
}

interface FormState {
  clubName: string
  description: string
  category: string
  expectedMembers: string
  requesterRole: RequesterRole
  contactInfo: string
}

const EMPTY_FORM: FormState = {
  clubName: '',
  description: '',
  category: '',
  expectedMembers: '',
  requesterRole: 'president',
  contactInfo: '',
}

function formFromRequest(req: ClubRegistrationRequest): FormState {
  return {
    clubName: req.clubName,
    description: req.description,
    category: req.category ?? '',
    expectedMembers: req.expectedMembers != null ? String(req.expectedMembers) : '',
    requesterRole: req.requesterRole ?? 'president',
    contactInfo: req.contactInfo ?? '',
  }
}

export default function OpenRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { user: clerkUser, isLoaded } = useUser()
  const { signOut } = useClerk()

  const [school, setSchool] = useState<SchoolInfo | null>(null)
  const [requests, setRequests] = useState<ClubRegistrationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/registrations?slug=${encodeURIComponent(slug)}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      setSchool(data.school)
      setRequests(data.requests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const pending = requests.find((r) => r.status === 'pending') ?? null
  const latest = requests[0] ?? null
  const approved = requests.find((r) => r.status === 'approved') ?? null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const isEdit = editing && pending
      const res = await fetch('/api/registrations', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          clubName: form.clubName.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          expectedMembers: form.expectedMembers ? Number(form.expectedMembers) : undefined,
          requesterRole: form.requesterRole,
          contactInfo: form.contactInfo.trim(),
        }),
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error(res.status === 401 ? 'Please sign in first.' : 'Something went wrong. Please try again.')
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      setEditing(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !school && !notFound) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Open registration isn&apos;t available here</h1>
          <p className="text-gray-500 text-sm mt-1">
            Double-check the link, or{' '}
            <Link href="/join" className="text-gray-700 underline">use an invite code</Link>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register a club at {school?.name}</h1>
          {school?.allowedEmailDomain && (
            <p className="text-gray-500 mt-1 text-sm">
              Open to students with a verified @{school.allowedEmailDomain} email. Submit your club for approval.
            </p>
          )}
        </div>

        {/* Not signed in */}
        {isLoaded && !clerkUser && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
            <p className="text-sm text-gray-600">
              Sign in{school?.allowedEmailDomain ? ` with your @${school.allowedEmailDomain} email` : ''} to register a club.
            </p>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(`/join/${slug}`)}`}
              className="inline-block w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Sign in to continue
            </Link>
          </div>
        )}

        {isLoaded && clerkUser && (
          <div className="space-y-4">
            {/* Signed-in identity chip */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-1.5">
                <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                  {(clerkUser.fullName ?? clerkUser.username ?? '?')[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.username}
                </span>
                <button
                  type="button"
                  onClick={() => signOut({ redirectUrl: `/sign-in?redirect_url=/join/${slug}` })}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors ml-1"
                >
                  <LogOut className="w-3 h-3" />
                  Switch
                </button>
              </div>
            </div>

            {/* Approved */}
            {approved && (
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">“{approved.clubName}” was approved</p>
                  <p className="text-sm text-gray-500 mt-0.5">You&apos;re the club admin. Head to your dashboard to manage it.</p>
                  <Link href="/dashboard" className="inline-block mt-2 text-sm text-gray-700 underline">Go to dashboard</Link>
                </div>
              </div>
            )}

            {/* Pending (view or edit) */}
            {!approved && pending && !editing && (
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">“{pending.clubName}” is awaiting review</p>
                    <p className="text-sm text-gray-500 mt-0.5">{pending.description}</p>
                    <button
                      type="button"
                      onClick={() => { setForm(formFromRequest(pending)); setEditing(true); setError(null) }}
                      className="mt-3 text-sm text-gray-700 underline"
                    >
                      Edit submission
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Denied banner (resubmit allowed) */}
            {!approved && !pending && latest?.status === 'denied' && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 flex items-start gap-3">
                <XCircle className="w-6 h-6 text-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-900">“{latest.clubName}” wasn&apos;t approved</p>
                  {latest.denialReason && (
                    <p className="text-sm text-gray-600 mt-0.5"><span className="font-medium">Reason:</span> {latest.denialReason}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">You can revise the details below and submit again.</p>
                </div>
              </div>
            )}

            {/* Form: shown when creating (no pending/approved) or editing a pending one */}
            {!approved && (editing || !pending) && (
              <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Club name</label>
                  <input
                    type="text" required maxLength={120}
                    value={form.clubName}
                    onChange={(e) => setForm({ ...form, clubName: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    required maxLength={2000} rows={4}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="text" maxLength={80}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected members <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input
                      type="number" min={1} max={100000}
                      value={form.expectedMembers}
                      onChange={(e) => setForm({ ...form, expectedMembers: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your role</label>
                  <select
                    value={form.requesterRole}
                    onChange={(e) => setForm({ ...form, requesterRole: e.target.value as RequesterRole })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 bg-white"
                  >
                    <option value="president">President</option>
                    <option value="officer">Officer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact info <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text" maxLength={200}
                    value={form.contactInfo}
                    onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
                    placeholder="Email, phone, or how the reviewer can reach you"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                  />
                </div>

                {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

                <div className="flex gap-3">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setForm(EMPTY_FORM); setError(null) }}
                      className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || !form.clubName.trim() || !form.description.trim()}
                    className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Submitting…' : editing ? 'Save changes' : 'Submit for approval'}
                  </button>
                </div>
              </form>
            )}

            {error && !editing && pending && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
