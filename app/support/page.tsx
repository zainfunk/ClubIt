import type { Metadata } from 'next'
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Support — ClubIt',
  description: 'Get help with ClubIt.',
}

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <P>
        Need help with ClubIt? We&apos;re happy to assist students, club leaders, advisors,
        and school admins.
      </P>

      <H2>Contact us</H2>
      <P>
        Email <a href="mailto:support@clubit.app" style={{ color: '#6366f1' }}>support@clubit.app</a> and
        we&apos;ll get back to you. To help us respond quickly, include your school name, your
        role (student, advisor, admin), and a short description of the issue.
      </P>

      <H2>Common questions</H2>
      <UL>
        <li><strong>How do I join my school&apos;s clubs?</strong> Sign in and use the invite code your school provides, or ask an admin to add you.</li>
        <li><strong>How do I check in to a meeting?</strong> Open the dashboard and scan the meeting&apos;s QR code with the in-app scanner.</li>
        <li><strong>How do I report or block someone in chat?</strong> Tap any message to report it or block the sender.</li>
        <li><strong>How do I delete my account?</strong> Go to Settings → Delete Account. This removes your identity and associated data.</li>
        <li><strong>I forgot my password.</strong> Use the &quot;Forgot password&quot; option on the sign-in screen.</li>
        <li><strong>Billing.</strong> ClubIt is free for students; schools manage their subscription. Contact your school admin for access questions.</li>
      </UL>

      <H2>Report a safety or security issue</H2>
      <P>
        For abuse you can&apos;t resolve with in-app report/block, or for security concerns,
        email <a href="mailto:security@clubit.app" style={{ color: '#6366f1' }}>security@clubit.app</a>.
      </P>

      <H2>More</H2>
      <P>
        See our <a href="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</a> and{' '}
        <a href="/terms" style={{ color: '#6366f1' }}>Terms of Service</a>.
      </P>
    </LegalPage>
  )
}
