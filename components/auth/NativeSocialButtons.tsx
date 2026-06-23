'use client'

import { useState } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

// Clerk native OAuth deep-link target: a custom URL scheme registered in
// ios/App/App/Info.plist (CFBundleURLTypes) and allowlisted in the Clerk
// dashboard (Native applications -> "Allowlist for mobile SSO redirect", with
// Native API enabled). Passing this as sso()'s `redirectCallbackUrl` makes
// Clerk treat the OAuth callback as NATIVE: it completes via a rotating-token
// nonce in the return URL instead of demanding the WKWebView's __client cookie
// (which the external browser doesn't have — the cause of `authorization_invalid`).
const REDIRECT_URL = 'com.clubit.app://sso-callback'

type Strategy = 'oauth_google' | 'oauth_apple'

/**
 * Native-only social sign-in buttons.
 *
 * Uses Clerk's Future-API `signIn.sso()` custom flow. sso() starts the sign-in
 * on the webview's Clerk client and navigates to the provider; Capacitor ejects
 * that to the system browser (Google bans embedded webviews). After auth, Clerk
 * returns to `redirectCallbackUrl` (our custom scheme) — a deep link that
 * NativeBootstrap routes to /sso-callback, where the webview's same client
 * finalizes the session via the nonce. One sso() attempt covers new users too:
 * Clerk marks a missing account transferable and /sso-callback transfers it.
 */
export default function NativeSocialButtons() {
  // This Clerk version's useSignIn() exposes the Future/signals custom-flow API:
  // { errors, fetchStatus, signIn: SignInFutureResource }. sso() returns
  // { error } and drives the navigation itself.
  const { signIn } = useSignIn()
  const [busy, setBusy] = useState<Strategy | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = async (strategy: Strategy) => {
    if (busy) return
    setError(null)
    setBusy(strategy)
    try {
      const { error: ssoError } = await signIn.sso({
        strategy,
        redirectUrl: '/',                  // final in-app destination after finalize
        redirectCallbackUrl: REDIRECT_URL, // native deep-link the provider returns to
      })
      if (ssoError) throw ssoError
      // sso() navigates to the provider (ejected to the system browser by
      // Capacitor). Control returns via the custom-scheme deep link -> handled
      // in NativeBootstrap -> /sso-callback. Keep `busy` set; the app leaves.
    } catch (e) {
      const msg =
        (e as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message ??
        (e as Error)?.message ??
        'Sign-in failed. Please try again.'
      setError(msg)
      setBusy(null)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => start('oauth_google')}
        disabled={busy !== null}
        className="h-11 w-full justify-center gap-2 text-base"
      >
        <GoogleIcon />
        {busy === 'oauth_google' ? 'Opening…' : 'Continue with Google'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => start('oauth_apple')}
        disabled={busy !== null}
        className="h-11 w-full justify-center gap-2 text-base"
      >
        <AppleIcon />
        {busy === 'oauth_apple' ? 'Opening…' : 'Continue with Apple'}
      </Button>
      {error && <p className="text-center text-sm text-destructive">{error}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="currentColor">
      <path d="M16.37 12.78c.02 2.62 2.3 3.49 2.32 3.5-.02.06-.36 1.25-1.2 2.48-.72 1.06-1.47 2.12-2.65 2.14-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.83.71-1.14.04-2-.15-2.74-1.2-1.5-2.17-2.65-6.13-1.1-8.81.76-1.33 2.13-2.17 3.61-2.19 1.12-.02 2.17.75 2.86.75.68 0 1.96-.93 3.3-.79.56.02 2.14.23 3.16 1.71-.08.05-1.88 1.1-1.86 3.28M14.2 4.6c.61-.74 1.02-1.77.91-2.8-.88.04-1.94.59-2.57 1.33-.56.65-1.06 1.7-.92 2.7.98.08 1.97-.5 2.58-1.23" />
    </svg>
  )
}
