'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { Copy, CheckCircle, AlertTriangle, Settings } from 'lucide-react'

interface SetupData {
  name: string
  district?: string
  contactName: string
  contactEmail: string
  studentInviteCode: string
  adminInviteCode: string
  advisorInviteCode: string
  expiresAt: string
  completedAt?: string
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
    >
      {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<SetupData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/setup/${token}`)
      .then(res => res.json())
      .then(json => {
        if (json.error) setError(json.error)
        else {
          setData(json)
          if (json.completedAt) setDone(true)
        }
      })
      .catch(() => setError('Failed to load setup information'))
  }, [token])

  async function markComplete() {
    setCompleting(true)
    await fetch(`/api/setup/${token}`, { method: 'POST' })
    setDone(true)
    setCompleting(false)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-100 rounded-2xl mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
          <p className="text-gray-500 text-sm">{error}</p>
          <p className="text-xs text-gray-400 mt-4">
            Contact <a href="mailto:support@clubit.app" className="underline">support@clubit.app</a> for a new link.
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  const expiryDate = new Date(data.expiresAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  })

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <Settings className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          {data.district && <p className="text-gray-400 text-sm mt-0.5">{data.district}</p>}
          <p className="text-gray-500 text-sm mt-2">School setup — share these codes with your community</p>
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
              <code className="text-lg font-mono font-bold tracking-widest text-gray-900">
                {data.studentInviteCode}
              </code>
              <CopyButton value={data.studentInviteCode} />
            </div>
          </div>

          {/* Advisor code */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Advisor invite code</p>
                <p className="text-sm text-gray-500 mt-0.5">Share with club advisors and teachers</p>
              </div>
              <span className="text-xs bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-medium">Advisors</span>
            </div>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <code className="text-lg font-mono font-bold tracking-widest text-gray-900">
                {data.advisorInviteCode}
              </code>
              <CopyButton value={data.advisorInviteCode} />
            </div>
            <p className="text-xs text-purple-600 mt-3">
              Advisors can create and manage clubs they own.
            </p>
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
              <code className="text-lg font-mono font-bold tracking-widest text-gray-900">
                {data.adminInviteCode}
              </code>
              <CopyButton value={data.adminInviteCode} />
            </div>
            <p className="text-xs text-amber-600 mt-3">
              Keep this code private. Anyone with it gets admin access.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">How students join</h3>
            <ol className="space-y-2 text-sm text-gray-600">
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">1.</span> Go to <strong>clubit.app</strong> and sign up</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">2.</span> After signing up, enter the invite code above</li>
              <li className="flex gap-2"><span className="text-gray-400 shrink-0">3.</span> They land on their school&apos;s dashboard</li>
            </ol>
          </div>

          {/* Expiry + completion */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Link expires {expiryDate}</p>
            {done ? (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle className="w-3.5 h-3.5" />
                Setup complete
              </span>
            ) : (
              <button
                onClick={markComplete}
                disabled={completing}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                {completing ? 'Saving…' : 'Mark as setup complete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
