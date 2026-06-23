import { headers } from 'next/headers'
import { SignUp } from '@clerk/nextjs'
import { isNativeUserAgent } from '@/lib/platform'
import NativeSocialButtons from '@/components/auth/NativeSocialButtons'

// On native, the hosted social buttons are hidden and replaced with the custom
// native-OAuth flow (see NativeSocialButtons). A single OAuth sign-in attempt
// covers new users too — Clerk transfers a missing account into a sign-up at
// /sso-callback. The email-based sign-up stays in the hosted component.
const HIDE_HOSTED_SOCIAL = {
  elements: {
    socialButtons: { display: 'none' },
    socialButtonsBlockButton: { display: 'none' },
    dividerRow: { display: 'none' },
  },
}

export default async function SignUpPage() {
  const native = isNativeUserAgent((await headers()).get('user-agent'))
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6">
      {native && <NativeSocialButtons />}
      {/* See sign-in page: keep post-signup navigation in-app rather than
          falling through to the hosted Account Portal. New users land on /join
          to enter their school/club code. Deep-link redirects still win. */}
      <SignUp fallbackRedirectUrl="/join" appearance={native ? HIDE_HOSTED_SOCIAL : undefined} />
    </div>
  )
}
