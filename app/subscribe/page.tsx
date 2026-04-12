import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import SubscribeClient from '@/components/landing/SubscribeClient'

// Server component: if not signed in, bounce to sign-up with a return URL.
// If signed in, render the client component that triggers Stripe Checkout.
export default async function SubscribePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-up?redirect_url=/subscribe')
  return <SubscribeClient />
}
