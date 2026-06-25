'use client'

import { useState } from 'react'
import { LogOut, AlertTriangle } from 'lucide-react'
import { useMockAuth } from '@/lib/mock-auth'

/**
 * Desktop "Leave school" affordance for the TopBar. Confirms before detaching,
 * and surfaces the sole-admin block (409) inline instead of silently failing.
 * On success the provider clears context and routes to /join.
 */
export default function LeaveSchoolButton() {
  const { leaveSchool, schoolName } = useMockAuth()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    const result = await leaveSchool()
    if (!result.ok) {
      setError(result.message ?? 'Could not leave the school.')
      setBusy(false)
      return
    }
    // success → provider redirects; leave the modal up until navigation.
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null) }}
        className="hidden md:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
        title="Leave school"
      >
        <LogOut className="w-3 h-3" />
        Leave School
      </button>

      {open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-6">
          <div
            onClick={() => !busy && setOpen(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" style={{ fontFamily: 'var(--font-inter)' }}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
              Leave {schoolName ?? 'this school'}?
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              You’ll be removed from your clubs at this school and returned to the join screen.
              You can rejoin later with an invite code.
            </p>

            {error && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700">
                {error}
              </div>
            )}

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="h-11 flex-1 rounded-xl bg-rose-600 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50"
              >
                {busy ? 'Leaving…' : 'Leave school'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
