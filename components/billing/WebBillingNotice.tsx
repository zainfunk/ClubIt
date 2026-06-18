import { Globe } from 'lucide-react'

/**
 * Shown in place of Stripe purchase / billing-management UI when ClubIt runs
 * inside the iOS app. Apple Guideline 3.1.1 forbids non-IAP payment for digital
 * subscriptions in-app, so schools manage billing on the web instead.
 *
 * Note: intentionally NOT a tappable external purchase link — just plain-text
 * guidance — to stay clear of Apple's anti-steering rules.
 */
export default function WebBillingNotice({ heading }: { heading?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mb-4">
          <Globe className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
          {heading ?? 'Manage your subscription on the web'}
        </h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
          Subscriptions and billing for ClubIt are handled on our website. Sign in
          at <span className="font-semibold text-slate-700">clubit.app</span> from any
          browser to start a plan, update payment details, or view invoices.
        </p>
      </div>
    </div>
  )
}
