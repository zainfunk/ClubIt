'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Hash, CheckCircle } from 'lucide-react'
import { saveSchoolSession, useMockAuth } from '@/lib/mock-auth'

export default function JoinPage() {
  const router = useRouter()
  const { user: clerkUser } = useUser()
  const { refreshSchoolContext } = useMockAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ schoolName: string; role: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      // Cache the school session so the user never needs to re-enter the code
      if (clerkUser?.id) {
        saveSchoolSession(clerkUser.id, {
          schoolId: data.schoolId,
          schoolName: data.schoolName,
          role: data.role,
          schoolStatus: data.schoolStatus,
        })
      }

      refreshSchoolContext()
      setSuccess({ schoolName: data.schoolName, role: data.role })
      setTimeout(() => router.replace('/dashboard'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Welcome to {success.schoolName}!</h1>
          <p className="text-gray-500 text-sm mt-1">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <Hash className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Enter your invite code</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Your school administrator provided a code to join.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Invite code</label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-STU-XXXX"
              spellCheck={false}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400 text-center"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 3}
            className="w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Checking…' : 'Join school'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Setting up a new school?{' '}
            <a href="/onboard" className="text-gray-700 underline">Register here</a>
          </p>
        </form>
      </div>
    </div>
  )
}
