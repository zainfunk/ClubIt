'use client'

import { useState } from 'react'
import { Ban, CreditCard, Mail, Loader2 } from 'lucide-react'
import { useMockAuth } from '@/lib/mock-auth'

export default function SchoolSuspendedPage() {
  const { schoolName, schoolContactEmail, schoolStatus } = useMockAuth()
  const [portalLoading, setPortalLoading] = useState(false)

  const isPaymentPaused = schoolStatus === 'payment_paused'

  async function handleUpdatePayment() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ${
          isPaymentPaused ? 'bg-orange-100' : 'bg-red-100'
        }`}>
          {isPaymentPaused
            ? <CreditCard className="w-8 h-8 text-orange-600" />
            : <Ban className="w-8 h-8 text-red-600" />
          }
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isPaymentPaused
            ? `${schoolName ?? 'This school'} is paused — payment issue`
            : `${schoolName ?? 'This school'} is currently suspended`
          }
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          {isPaymentPaused
            ? 'Access is temporarily paused because we could not process your subscription payment. Once the payment is resolved, your school will be reactivated automatically.'
            : 'Access to the live app is paused for this school right now. Once the school is reactivated, everyone will be able to continue using Clubit normally.'
          }
        </p>

        {isPaymentPaused && (
          <button
            onClick={handleUpdatePayment}
            disabled={portalLoading}
            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg transition-all disabled:opacity-60 mb-6"
          >
            {portalLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Update Payment Method
              </>
            )}
          </button>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Need help?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Reach out to your school administrator or contact{' '}
                <a
                  href={`mailto:${schoolContactEmail ?? 'support@clubit.app'}`}
                  className="underline"
                >
                  {schoolContactEmail ?? 'support@clubit.app'}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
