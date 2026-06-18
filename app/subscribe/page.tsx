import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import SubscribeClient from '@/components/landing/SubscribeClient'
import WebBillingNotice from '@/components/billing/WebBillingNotice'
import { isNativeUserAgent } from '@/lib/platform'

// Server component: if not signed in, bounce to sign-up with a return URL.
// If signed in, render the client component that triggers Stripe Checkout.
//
// On the iOS app we must NOT initiate Stripe Checkout (Apple Guideline 3.1.1),
// so we render a web-only billing notice instead of auto-redirecting to Stripe.
export default async function SubscribePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?force_redirect_url=/subscribe')

  const ua = (await headers()).get('user-agent')
  if (isNativeUserAgent(ua)) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <WebBillingNotice heading="Start your subscription on the web" />
        </div>
      </div>
    )
  }

  return <SubscribeClient />
}
