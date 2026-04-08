'use client'

import { Ban, Mail } from 'lucide-react'
import { useMockAuth } from '@/lib/mock-auth'

export default function SchoolSuspendedPage() {
  const { schoolName, schoolContactEmail } = useMockAuth()

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6">
          <Ban className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {schoolName ?? 'This school'} is currently suspended
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          Access to the live app is paused for this school right now. Once the school is reactivated,
          everyone will be able to continue using Clubit normally.
        </p>

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
