import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      {/* See sign-in page: keep post-signup navigation in-app rather than
          falling through to the hosted Account Portal. New users land on /join
          to enter their school/club code. Deep-link redirects still win. */}
      <SignUp fallbackRedirectUrl="/join" />
    </div>
  )
}
