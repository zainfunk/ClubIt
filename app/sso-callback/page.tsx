'use client'

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs'

/**
 * Completion page for the native OAuth custom flow.
 *
 * After the provider sign-in finishes in the in-app browser, Clerk redirects to
 * the custom scheme `com.clubit.app://sso-callback?rotating_token_nonce=...`.
 * NativeBootstrap catches that deep link and client-navigates here, preserving
 * the query string. <AuthenticateWithRedirectCallback> reads the nonce, claims
 * the verified session on THIS (webview) Clerk client, and activates it — then
 * redirects. It also transfers new social users into a sign-up automatically.
 *
 *   - returning user  -> "/" (role-routes to dashboard/superadmin)
 *   - brand-new user  -> "/join" (enter school/club code)
 */
export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/"
        signUpForceRedirectUrl="/join"
        continueSignUpUrl="/sign-up"
      />
    </div>
  )
}
