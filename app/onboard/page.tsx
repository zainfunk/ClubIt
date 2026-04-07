'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { School, Building2, Mail, User, MapPin } from 'lucide-react'

export default function OnboardPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    district: '',
    contactName: '',
    contactEmail: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      router.push('/onboard/pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-2xl mb-4">
            <School className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Register your school</h1>
          <p className="text-gray-500 mt-1 text-sm">
            We&apos;ll review your request and send invite codes within one business day.
          </p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-5">
          {/* School name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">School name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Oakridge High School"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              School district <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={form.district}
                onChange={e => update('district', e.target.value)}
                placeholder="Oakridge Unified School District"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Contact name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Your name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={form.contactName}
                onChange={e => update('contactName', e.target.value)}
                placeholder="Principal or staff contact"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
              />
            </div>
          </div>

          {/* Contact email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={form.contactEmail}
                onChange={e => update('contactEmail', e.target.value)}
                placeholder="you@oakridge.edu"
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
            {loading ? 'Submitting…' : 'Submit registration request'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Already have an invite code?{' '}
            <a href="/join" className="text-gray-700 underline">Join here</a>
          </p>
        </form>
      </div>
    </div>
  )
}
