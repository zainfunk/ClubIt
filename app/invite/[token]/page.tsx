'use client'

import { use, useEffect, useState } from 'react'
import { Building2, MapPin, User, Copy, CheckCircle, AlertTriangle } from 'lucide-react'

interface Codes {
  schoolName: string
  studentInviteCode: string
  adminInviteCode: string
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', district: '', contactName: '' })
  const [loading, setLoading] = useState(false)
  const [codes, setCodes] = useState<Codes | null>(null)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setEmail(d.email)
      })
      .catch(() => setError('Failed to load invite'))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      setCodes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error && !codes) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invite unavailable</h1>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-xs text-gray-400 mt-4">
            Contact <a href="mailto:support@clubit.app" className="underline">support@clubit.app</a> for help.
          </p>
        </div>
      </div>
    )
  }

  // ── Success state — show invite codes ─────────────────────────────────────
  if (codes) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 rounded-2xl mb-4">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{codes.schoolName} is ready!</h1>
            <p className="text-gray-500 text-sm mt-1">Share these codes with your school community</p>
          </div>

          <div className="space-y-4">
            {/* Student code */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Student invite code</p>
                  <p className="text-sm text-gray-500 mt-0.5">Share with all students</p>
                </div>
                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">Students</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <code className="text-lg font-mono font-bold tracking-widest text-gray-900">{codes.studentInviteCode}</code>
                <CopyButton value={codes.studentInviteCode} />
              </div>
            </div>

            {/* Admin code */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Admin invite code</p>
                  <p className="text-sm text-gray-500 mt-0.5">Share only with staff administrators</p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">Admins</span>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <code className="text-lg font-mono font-bold tracking-widest text-gray-900">{codes.adminInviteCode}</code>
                <CopyButton value={codes.adminInviteCode} />
              </div>
              <p className="text-xs text-amber-600 mt-3">Keep this code private — it grants admin access.</p>
            </div>

            {/* Next steps */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">How to get started</h3>
              <ol className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2"><span className="text-gray-400 shrink-0">1.</span>Go to <strong>clubit.app/sign-up</strong> and create your account</li>
                <li className="flex gap-2"><span className="text-gray-400 shrink-0">2.</span>Enter your <strong>admin code</strong> above to get admin access</li>
                <li className="flex gap-2"><span className="text-gray-400 shrink-0">3.</span>Share the student code with your students</li>
              </ol>
            </div>

            <a
              href="/sign-up"
              className="block w-full bg-black text-white text-center py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Create your admin account →
            </a>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!email) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  // ── Form state ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set up your school</h1>
          <p className="text-gray-500 text-sm mt-1">
            You were invited as <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Oakridge High School"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              School district <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.district}
                onChange={e => setForm(f => ({ ...f, district: e.target.value }))}
                placeholder="Oakridge Unified School District"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={form.contactName}
                onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                placeholder="Principal or IT contact"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Setting up…' : 'Set up school'}
          </button>
        </form>
      </div>
    </div>
  )
}
