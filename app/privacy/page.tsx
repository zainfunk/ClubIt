import type { Metadata } from 'next'
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Privacy Policy — ClubIt',
  description: "How ClubIt handles your data. No ads, no third-party tracking.",
}

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="June 22, 2026">
      <P>
        ClubIt is a club-management platform for schools. This policy explains what we
        collect, how we use it, and the choices you have. In plain terms: we collect only
        what we need to run the product, we don&apos;t show ads, and we don&apos;t track you
        or sell your data.
      </P>

      <H2>Who controls your data</H2>
      <P>
        ClubIt is provided to you because your school subscribes to it. For school records,
        your <strong>school is the data controller</strong> and ClubIt acts as its processor
        under the school&apos;s agreement with us (including FERPA where it applies). This
        policy covers your individual use of the app.
      </P>

      <H2>What we collect</H2>
      <UL>
        <li><strong>Account info:</strong> your name and email address, used to create your account and connect you to your school. Authentication is handled by Clerk.</li>
        <li><strong>School activity:</strong> club memberships, attendance/check-ins, chat messages, posts, and votes — the core functions of the product.</li>
        <li><strong>Profile content:</strong> anything you choose to add, such as a profile photo.</li>
        <li><strong>Location:</strong> requested <em>only</em> at the moment you check in to a meeting by QR code, to confirm you&apos;re there. It is not stored as a tracking profile.</li>
      </UL>

      <H2>How we use it</H2>
      <P>
        We use your information solely to provide and operate ClubIt: signing you in,
        showing you your school&apos;s clubs, enabling chat and elections, recording
        attendance, and keeping the service secure. We do not use it for advertising.
      </P>

      <H2>What we don&apos;t do</H2>
      <UL>
        <li>No advertising and no ad networks.</li>
        <li>No third-party analytics, marketing, or tracking SDKs.</li>
        <li>No selling or renting of personal data.</li>
        <li>No tracking you across other apps or websites.</li>
      </UL>

      <H2>Service providers</H2>
      <P>
        We rely on a small number of processors to run the service: <strong>Clerk</strong>{' '}
        (authentication) and <strong>Supabase</strong> (database and storage). They process
        data on our behalf to provide the product and are not permitted to use it for their
        own purposes.
      </P>

      <H2>Children&apos;s and student privacy</H2>
      <P>
        ClubIt is used by students, including minors. You must be 13 or older, or have your
        parent&apos;s consent provided through your school, to use ClubIt. Because the service
        is provided through your school, the school authorizes student use and governs
        education records under FERPA/COPPA. We do not knowingly use student data for any
        purpose other than providing the service.
      </P>

      <H2>Your choices and controls</H2>
      <UL>
        <li><strong>Delete your account</strong> in the app: Settings → Delete Account. This removes your identity and scrubs your associated data.</li>
        <li><strong>Privacy settings</strong> control what other members can see about you.</li>
        <li><strong>Block and report</strong> are available on any chat message.</li>
        <li>Your school can also facilitate data access or deletion on your behalf.</li>
      </UL>

      <H2>Data retention &amp; security</H2>
      <P>
        We keep your information for as long as your account is active with your school, and
        delete or anonymize it on account deletion or when your school ends its subscription.
        We use industry-standard safeguards (encryption in transit, access controls, audit
        logging) to protect your data.
      </P>

      <H2>Changes</H2>
      <P>
        We&apos;ll post material changes here and update the date above. Continued use after a
        change means you accept the updated policy.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about privacy: <a href="mailto:support@clubit.app" style={{ color: '#6366f1' }}>support@clubit.app</a>.
        Security concerns: <a href="mailto:security@clubit.app" style={{ color: '#6366f1' }}>security@clubit.app</a>.
      </P>
    </LegalPage>
  )
}
