import { Clock, Mail } from 'lucide-react'

export default function OnboardPendingPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-2xl mb-6">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Request received</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          We&apos;ve received your school registration request. Our team will review it and reach out to
          you within one business day.
        </p>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-left space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Check your email</p>
              <p className="text-xs text-gray-500 mt-0.5">
                You&apos;ll receive an email with your setup link and invite codes once approved.
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Questions? Email{' '}
          <a href="mailto:support@clubit.app" className="underline">support@clubit.app</a>
        </p>
      </div>
    </div>
  )
}
