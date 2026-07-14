'use client'

import { useEffect, useState, type ReactNode } from 'react'

// EULA / terms agreement gate shown before sign-in or sign-up (App Store
// Guideline 1.2 — User-Generated Content). Apple requires that users agree to
// terms making clear there is zero tolerance for objectionable content or
// abusive users BEFORE registering or logging in.
//
// The agreement is always presented above the auth controls. The controls
// (native social buttons + the Clerk hosted form, passed as children) are
// disabled — visually dimmed and made inert — until the box is checked.
// Acceptance is remembered so returning users aren't re-prompted every launch,
// but the agreement text stays visible on the sign-in screen at all times.

const ACCEPT_KEY = 'clubit_terms_accepted_v1'

export default function AuthGate({ children }: { children: ReactNode }) {
  // Start false on both server and first client render (avoids a hydration
  // mismatch); a returning user's stored acceptance is applied in the effect.
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(ACCEPT_KEY) === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration of persisted consent from an external store (localStorage)
        setAgreed(true)
      }
    } catch {
      // localStorage unavailable (private mode / WKWebView edge cases) — the
      // user can still tick the box; we just can't persist it.
    }
  }, [])

  function toggle(next: boolean) {
    setAgreed(next)
    try {
      if (next) localStorage.setItem(ACCEPT_KEY, '1')
      else localStorage.removeItem(ACCEPT_KEY)
    } catch {
      /* non-fatal */
    }
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4">
      <label className="flex items-start gap-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-left cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-black cursor-pointer"
          aria-describedby="auth-terms-text"
        />
        <span id="auth-terms-text" className="text-xs leading-relaxed text-gray-600">
          I agree to ClubIt&apos;s{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
            Terms of Use (EULA)
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 underline">
            Privacy Policy
          </a>
          . I understand ClubIt has <strong className="font-semibold text-gray-900">zero tolerance for objectionable
          content or abusive behavior</strong>, and that such content and users can be reported and blocked.
        </span>
      </label>

      <div
        className={
          'w-full flex flex-col items-center gap-4 transition-opacity ' +
          (agreed ? 'opacity-100' : 'opacity-40 pointer-events-none select-none')
        }
        aria-disabled={!agreed}
        // inert blocks keyboard/tab access too, so the gate can't be bypassed by
        // focusing a control the dimming only hides visually.
        inert={!agreed}
      >
        {children}
      </div>

      {!agreed && (
        <p className="text-xs text-gray-400 text-center">
          Please agree to the terms above to continue.
        </p>
      )}
    </div>
  )
}
