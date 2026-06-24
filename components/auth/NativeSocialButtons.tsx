'use client'

import { useEffect, useRef, useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

// Native-only social sign-in via @capgo/capacitor-social-login.
//
// Web OAuth from a Capacitor webview cannot redirect to a custom URL scheme
// (com.clubit.app://): Clerk's /v1/oauth_callback only allows HTTPS redirect
// targets for the web OAuth path, so every JS-only attempt produced
// `authorization_invalid`. See git log (c71efe4 / aafe992 / e1398f5 /
// 9a6a970 / 1f0d10e) for the failed workarounds.
//
// The architecturally correct fix is to skip the browser hop entirely:
//   1. Get a provider ID token from a native SDK (no browser, no cookies).
//   2. POST it to Clerk via signIn.create({ strategy, token }). Clerk
//      verifies the token signature server-side and creates the session.
// App Store Guideline 4.8 also effectively requires native Sign In with
// Apple if any other social option is offered.
//
// Env vars (Vercel prod):
//   NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID  iOS OAuth client from Google Cloud.
//                                     Reversed value is also wired into
//                                     ios/App/App/Info.plist as a URL scheme.
//   NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID  Web OAuth client (same one Clerk uses).
//                                     Required as iOSServerClientId so the
//                                     returned ID token is accepted by Clerk.
// Apple: no client ID needed at the native call site; the system Sign In
// with Apple service is used (the bundle ID com.clubit.app is the audience).

type Strategy = 'oauth_google' | 'oauth_apple'

export default function NativeSocialButtons() {
  const clerk = useClerk()
  const router = useRouter()
  const [busy, setBusy] = useState<Strategy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void (async () => {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      await SocialLogin.initialize({
        google: {
          iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
          iOSServerClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
          mode: 'online',
        },
        apple: {
          clientId: 'com.clubit.app',
        },
      })
    })()
  }, [])

  const start = async (strategy: Strategy) => {
    if (busy) return
    setError(null)
    setBusy(strategy)
    try {
      const { SocialLogin } = await import('@capgo/capacitor-social-login')
      let token: string | undefined
      let clerkStrategy: 'google_one_tap' | 'oauth_token_apple'

      if (strategy === 'oauth_google') {
        const res = await SocialLogin.login({
          provider: 'google',
          options: { scopes: ['email', 'profile'] },
        })
        const result = (res as { result?: { idToken?: string } }).result
        token = result?.idToken
        clerkStrategy = 'google_one_tap'
      } else {
        const res = await SocialLogin.login({
          provider: 'apple',
          options: { scopes: ['email', 'name'] },
        })
        const result = (res as { result?: { identityToken?: string } }).result
        token = result?.identityToken
        clerkStrategy = 'oauth_token_apple'
      }

      if (!token) throw new Error('No identity token returned by the provider.')

      const signIn = await clerk.client.signIn.create({
        strategy: clerkStrategy,
        token,
      })
      if (signIn.createdSessionId) {
        await clerk.setActive({ session: signIn.createdSessionId })
        router.push('/')
        return
      }
      if (signIn.firstFactorVerification.status === 'transferable') {
        const signUp = await clerk.client.signUp.create({ transfer: true })
        if (signUp.createdSessionId) {
          await clerk.setActive({ session: signUp.createdSessionId })
          router.push('/join')
          return
        }
      }
      router.push('/sign-up')
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
        {busy === 'oauth_google' ? 'Signing in…' : 'Continue with Google'}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => start('oauth_apple')}
        disabled={busy !== null}
        className="h-11 w-full justify-center gap-2 text-base"
      >
        <AppleIcon />
        {busy === 'oauth_apple' ? 'Signing in…' : 'Continue with Apple'}
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
