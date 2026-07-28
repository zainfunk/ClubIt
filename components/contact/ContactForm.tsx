'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Loader2 } from 'lucide-react'

// Sales-inquiry form for the public marketing site. ClubIt is billed per
// student, so prospects contact us to get a quote instead of self-serve
// checkout. Submits to /api/contact, which stores the request in Supabase.
export default function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)

    const form = new FormData(e.currentTarget)
    const rawCount = String(form.get('studentCount') ?? '').trim()
    const payload = {
      name: String(form.get('name') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      schoolName: String(form.get('schoolName') ?? '').trim(),
      district: String(form.get('district') ?? '').trim(),
      role: String(form.get('role') ?? '').trim(),
      studentCount: rawCount ? Number(rawCount) : undefined,
      message: String(form.get('message') ?? '').trim(),
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Something went wrong. Please try again.')
      }
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-manrope)' }}>
          Thanks — we got it.
        </h2>
        <p className="text-slate-600 mb-6">
          Our team will review your details and get back to you within the next week to set up
          ClubIt for your school and share a quote.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
        >
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-6 sm:p-8 space-y-5"
    >
      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Your name" htmlFor="name">
          <input id="name" name="name" type="text" required maxLength={120} className={inputClass} placeholder="Jane Doe" />
        </Field>
        <Field label="Work email" htmlFor="email">
          <input id="email" name="email" type="email" required maxLength={200} className={inputClass} placeholder="jane@school.edu" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="School name" htmlFor="schoolName">
          <input id="schoolName" name="schoolName" type="text" required maxLength={200} className={inputClass} placeholder="Westview High" />
        </Field>
        <Field label="School district" htmlFor="district" optional>
          <input id="district" name="district" type="text" maxLength={200} className={inputClass} placeholder="Westview Unified School District" />
        </Field>
      </div>

      <Field label="Your role" htmlFor="role" optional>
        <select id="role" name="role" defaultValue="" className={inputClass}>
          <option value="">Select…</option>
          <option value="Admin / Principal">Admin / Principal</option>
          <option value="Teacher / Advisor">Teacher / Advisor</option>
          <option value="District staff">District staff</option>
          <option value="Student">Student</option>
          <option value="Other">Other</option>
        </select>
      </Field>

      <Field label="Approx. number of students" htmlFor="studentCount" optional>
        <input
          id="studentCount"
          name="studentCount"
          type="number"
          min={0}
          max={1000000}
          inputMode="numeric"
          className={inputClass}
          placeholder="e.g. 800"
        />
        <p className="mt-1 text-xs text-slate-400">Billed at $1.50 per student, per year — this helps us prepare your quote.</p>
      </Field>

      <Field label="Anything else?" htmlFor="message" optional>
        <textarea id="message" name="message" rows={4} maxLength={4000} className={inputClass} placeholder="Tell us about your school and what you're looking for." />
      </Field>

      {status === 'error' && error && (
        <p className="text-sm font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="group w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold shadow-xl shadow-slate-900/20 transition-all"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            Send message
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
      <p className="text-center text-xs text-slate-400">
        We&apos;ll only use your details to respond to this inquiry.
      </p>
    </form>
  )
}

const inputClass =
  'w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition'

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 mb-1.5">
        {label}
        {optional && <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
