import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      {/* fallbackRedirectUrl keeps post-login navigation inside the app: root
          ('/') role-routes to /dashboard or /superadmin. Without it Clerk
          falls back to the hosted Account Portal on clerk.clubit.app, which
          strands the native webview off-app. Deep-link redirect_url params
          (e.g. invite flows) still take precedence over this default. */}
      <SignIn fallbackRedirectUrl="/" />
    </div>
  )
}
