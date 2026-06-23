'use client'

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'

// Clerk native OAuth redirect target: a custom URL scheme registered in
// ios/App/App/Info.plist (CFBundleURLTypes) and allowlisted under Clerk
// Dashboard -> Native Applications -> mobile SSO redirect URLs.
//
// IMPORTANT: the entire Clerk handshake (clerk.clubit.app -> Google ->
// clerk.clubit.app/v1/oauth_callback) MUST happen inside a single cookie
// context. The naive approach (`window.location.href = providerUrl`) splits
// the cookies: allowNavigation accepts clubit.app so the webview LOADS the
// first Clerk redirect itself, dropping session cookies in the WKWebView's
// cookie jar; only the follow-up hop to accounts.google.com gets ejected to
// Safari; Google then posts back to Clerk inside Safari, which has none of
// those cookies -> `authorization_invalid`. Commit c71efe4 hit this exact
// bug.
//
// The fix is `window.open(url, '_system')`. Capacitor's WKWebView UIDelegate
// hands window.open URLs to UIApplication.shared.open(), which routes them
// to Safari directly without ever loading them in the webview. Clerk sets
// session cookies in Safari from the very first request, the entire Google
// round-trip stays in Safari, and the final com.clubit.app:// redirect is
// captured by iOS's URL-scheme handler (NativeBootstrap's appUrlOpen
// listener) and routed to /sso-callback. /sso-callback then claims the
// session via the rotating_token_nonce in the URL — no cookies required at
// that final step.
//
// This avoids @capacitor/browser entirely, so it works regardless of
// whether the current TestFlight binary was archived with the plugin
// compiled in (the prior reason c71efe4 dropped Browser.open).
const REDIRECT_URL = 'com.clubit.app://sso-callback'

type Strategy = 'oauth_google' | 'oauth_apple'

/**
 * Native-only social sign-in buttons.
 *
 * The hosted Clerk <SignIn>/<SignUp> social buttons do a same-context redirect
 * that Capacitor ejects to Safari mid-flow, splitting the cookie context and
 * breaking the OAuth round-trip. Here we instead create the sign-in attempt
 * server-side (cookieless), then open Clerk's verification URL directly in
 * Safari via window.open('_system') so the entire Clerk <-> Google handshake
 * lives in one cookie jar.
 *
 * A single sign-in attempt covers both returning users and new sign-ups:
 * Clerk marks a missing account as `transferable` and /sso-callback transfers
 * it to a sign-up automatically.
 */
export default function NativeSocialButtons() {
  const clerk = useClerk()
  const [busy, setBusy] = useState<Strategy | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = async (strategy: Strategy) => {
    if (busy) return
    setError(null)
    setBusy(strategy)
    try {
      const signIn = await clerk.client.signIn.create({
        strategy,
        redirectUrl: REDIRECT_URL,
        actionCompleteRedirectUrl: REDIRECT_URL,
      })
      const url = signIn.firstFactorVerification.externalVerificationRedirectURL
      if (!url) throw new Error('Could not start sign-in. Please try again.')
      // window.open(_, '_system') -> Capacitor hands the URL to
      // UIApplication.shared.open(), which opens Safari directly. The whole
      // Clerk <-> Google handshake then lives in Safari's cookie jar; the
      // final com.clubit.app://sso-callback redirect is caught by
      // NativeBootstrap's appUrlOpen and routed to /sso-callback. Keep
      // `busy` true so buttons stay disabled while the callback takes over.
      window.open(url.toString(), '_system')
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
