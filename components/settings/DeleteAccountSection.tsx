'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react'

// In-app account deletion (App Store Guideline 5.1.1(v)). Lives in Settings so
// every user can permanently delete their own account without leaving the app.
export default function DeleteAccountSection() {
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.status === 'deleted') {
        // Account is gone — end the session and return to the sign-in screen.
        await signOut({ redirectUrl: '/sign-in' })
        return
      }

      if (res.status === 409 && data.status === 'admin_requires_transfer') {
        setError(
          data.message ??
            'Because this account manages a school, deletion needs ownership transfer first. We’ve logged your request.',
        )
        setLoading(false)
        return
      }

      setError(data.error ?? 'Could not delete your account. Please try again.')
      setLoading(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white border border-rose-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-rose-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
          <Trash2 className="w-4 h-4" />
        </div>
        <h2 className="font-bold text-slate-900 text-[15px]" style={{ fontFamily: 'var(--font-manrope)' }}>
          Delete Account
        </h2>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-3">
        <p className="text-sm text-slate-600 leading-relaxed">
          Permanently delete your ClubIt account and personal data. This removes
          your sign-in, profile, club memberships, and attendance records. This
          action cannot be undone.
        </p>
        <button
          onClick={() => { setOpen(true); setError(null); setConfirmText('') }}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete my account
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900">Delete your account?</h3>
              </div>
              {!loading && (
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                This permanently deletes your account and personal data and signs
                you out. It cannot be undone. Type <span className="font-bold text-slate-900">DELETE</span> to confirm.
              </p>

              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
                disabled={loading}
                className="w-full text-sm rounded-lg px-4 py-2.5 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300"
              />

              {error && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading || confirmText !== 'DELETE'}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {loading ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
