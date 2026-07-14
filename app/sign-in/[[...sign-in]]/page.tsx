import { headers } from 'next/headers'
import { SignIn } from '@clerk/nextjs'
import { isNativeUserAgent } from '@/lib/platform'
import NativeSocialButtons from '@/components/auth/NativeSocialButtons'
import AuthGate from '@/components/auth/AuthGate'

// On native, the hosted social buttons are hidden (they break in the WKWebView —
// see NativeSocialButtons) and replaced with the custom native-OAuth flow. The
// email/password flow stays in the hosted component, which works inside the
// webview. Branching on the request UA keeps it flash-free (no client swap).
const HIDE_HOSTED_SOCIAL = {
  elements: {
    socialButtons: { display: 'none' },
    socialButtonsBlockButton: { display: 'none' },
    dividerRow: { display: 'none' },
  },
}

export default async function SignInPage() {
  const native = isNativeUserAgent((await headers()).get('user-agent'))
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6">
      {/* AuthGate presents the EULA/terms agreement and disables the auth
          controls until the user agrees (App Store Guideline 1.2). */}
      <AuthGate>
        {native && <NativeSocialButtons />}
        {/* fallbackRedirectUrl keeps post-login navigation inside the app: root
            ('/') role-routes to /dashboard or /superadmin. Without it Clerk
            falls back to the hosted Account Portal on clerk.clubit.app, which
            strands the native webview off-app. Deep-link redirect_url params
            (e.g. invite flows) still take precedence over this default. */}
        <SignIn fallbackRedirectUrl="/" appearance={native ? HIDE_HOSTED_SOCIAL : undefined} />
      </AuthGate>
    </div>
  )
}
