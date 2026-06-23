'use client'

import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'

// Dedicated entry point for the iOS native social sign-in flow.
//
// Why this page exists: from inside the Capacitor WKWebView, any attempt to
// run Clerk's OAuth handshake leaks cookies between the webview (where the
// JS runs) and Safari (where Google forces us). When Clerk's callback hits
// clerk.clubit.app/v1/oauth_callback in Safari, Safari has none of the
// session cookies the webview set during signIn.create(), so Clerk rejects
// with `authorization_invalid` (see git log c71efe4/aafe992/e1398f5).
//
// The fix: open THIS page in Safari from the app via window.open. Once this
// page renders in Safari, signIn.authenticateWithRedirect() runs entirely
// inside Safari — session cookies are set, the OAuth round-trip happens, and
// Google's callback to clerk.clubit.app finds the cookies it needs. The
// final com.clubit.app://sso-callback redirect is caught by iOS's URL-scheme
// handler (NativeBootstrap's appUrlOpen) and the webview's /sso-callback
// page claims the session via the rotating_token_nonce in the URL.
//
// Query params (set by components/auth/NativeSocialButtons.tsx):
//   ?strategy=oauth_google|oauth_apple
const REDIRECT_URL = 'com.clubit.app://sso-callback'

export default function NativeSSOLauncher() {
  const clerk = useClerk()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // useClerk() is typed as LoadedClerk but `client` can be undefined on
    // first render before Clerk's JS finishes bootstrapping. Wait for the
    // loaded signal before trying to start the OAuth flow.
    if (!clerk?.loaded || !clerk.client?.signIn) return
    if (started.current) return
    started.current = true
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const strategy = params.get('strategy') === 'oauth_apple'
          ? 'oauth_apple'
          : 'oauth_google'
        await clerk.client.signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: REDIRECT_URL,
          redirectUrlComplete: REDIRECT_URL,
        })
      } catch (e) {
        setError(
          (e as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message ??
            (e as Error)?.message ??
            'Sign-in failed. Please try again.',
        )
      }
    })()
  }, [clerk, clerk?.loaded])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f8f9fa] p-6 text-center">
      <p className="text-base">Redirecting to your provider…</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
