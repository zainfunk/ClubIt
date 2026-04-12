'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

// Auto-triggers Stripe Checkout on mount. Shows a brief loading state
// while the session is created and the redirect happens.
export default function SubscribeClient() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function startCheckout() {
      try {
        const res = await fetch('/api/checkout', { method: 'POST' })
        const data = await res.json()
        if (cancelled) return

        if (!res.ok || !data.url) {
          setError(data.error ?? 'Failed to start checkout')
          return
        }

        window.location.href = data.url
      } catch {
        if (!cancelled) setError('Something went wrong. Please try again.')
      }
    }

    void startCheckout()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 mb-6 shadow-lg">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        {error ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Checkout failed</h1>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => { setError(null); window.location.reload() }}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-1">Redirecting to checkout...</h1>
            <p className="text-sm text-gray-500">You'll be taken to Stripe to complete your subscription.</p>
          </>
        )}
      </div>
    </div>
  )
}
