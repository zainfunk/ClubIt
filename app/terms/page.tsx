import type { Metadata } from 'next'
import { LegalPage, H2, P, UL } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Terms of Service — ClubIt',
  description: 'The terms that govern your use of ClubIt.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="June 22, 2026">
      <P>
        These terms govern your use of ClubIt&apos;s web and iOS apps. If you use ClubIt
        because your school signed up for it, the school&apos;s contract with us controls the
        school&apos;s data; these terms govern your individual use.
      </P>

      <H2>The service</H2>
      <P>
        ClubIt is a club-management platform. We provide tools for managing club rosters,
        taking attendance, club chat, scheduling events, running polls and elections, and
        related features. Features may change as we improve the product.
      </P>

      <H2>Eligibility and accounts</H2>
      <UL>
        <li>You must be 13 or older, or have your parent&apos;s consent provided through your school.</li>
        <li>You must be authorized by your school — via an invite code or by being added by an admin.</li>
        <li>Keep your credentials secure. One account per person; don&apos;t share accounts or impersonate others.</li>
      </UL>

      <H2>Acceptable use</H2>
      <P>Don&apos;t:</P>
      <UL>
        <li>Post content that is illegal, harassing, sexually explicit, threatening, or that violates others&apos; rights.</li>
        <li>Bully, dox, or target individuals.</li>
        <li>Access data belonging to clubs or schools you&apos;re not a member of.</li>
        <li>Probe, scan, attack, scrape, or run bots against the service, or circumvent rate limits, logging, or access controls.</li>
        <li>Spoof identity in any way (fake invite submissions, fake votes, impersonation).</li>
      </UL>
      <P>Violations may result in suspension by your school&apos;s admin, or by ClubIt in egregious cases.</P>

      <H2>Content you post</H2>
      <P>
        You keep the rights you had in what you post. By posting, you grant ClubIt and your
        school a license to host and display it solely to operate the service. We don&apos;t
        claim ownership of your messages or profile content.
      </P>

      <H2>Zero tolerance for objectionable content</H2>
      <P>
        Because ClubIt is used by students, including minors, we have <strong>zero tolerance</strong>{' '}
        for objectionable content and abusive behavior. Hate speech, slurs, sexual content,
        harassment, bullying, threats, and any content that exploits or endangers minors are
        strictly prohibited. We enforce this through:
      </P>
      <UL>
        <li><strong>Automated filtering</strong> — prohibited language is blocked before a message posts.</li>
        <li><strong>Reporting</strong> — any user can report a message from inside the app.</li>
        <li><strong>Blocking</strong> — any user can block another and stop seeing their messages.</li>
        <li><strong>Action within 24 hours</strong> — administrators review reports and remove violating content and/or remove offending users, targeting action within 24 hours.</li>
      </UL>
      <P>Accounts that violate this policy may be suspended or terminated.</P>

      <H2>Privacy</H2>
      <P>
        Our handling of your data is described in our <a href="/privacy" style={{ color: '#6366f1' }}>Privacy Policy</a>.
        For education records under FERPA, your school is the controller and ClubIt is the
        processor.
      </P>

      <H2>Subscriptions</H2>
      <P>
        Subscriptions are billed at the school level; individual users are not billed. ClubIt
        is free for students.
      </P>

      <H2>Termination</H2>
      <P>
        Your access lasts while your school keeps you enrolled and your account is in good
        standing. We may suspend or terminate access for violations of these terms,
        nonpayment by the school, security necessity, or as required by law.
      </P>

      <H2>Disclaimers &amp; liability</H2>
      <P>
        To the fullest extent permitted by law, the service is provided &quot;as is&quot; and
        &quot;as available,&quot; without warranties, and our liability is limited to the
        maximum extent allowed by law. We are not liable for indirect, incidental, or
        consequential damages.
      </P>

      <H2>Changes</H2>
      <P>
        We&apos;ll post material changes here and notify you (or your school&apos;s admin)
        before they take effect. Continued use constitutes acceptance.
      </P>

      <H2>Contact</H2>
      <P>
        Support: <a href="mailto:support@clubit.app" style={{ color: '#6366f1' }}>support@clubit.app</a> ·
        Security: <a href="mailto:security@clubit.app" style={{ color: '#6366f1' }}>security@clubit.app</a>
      </P>
    </LegalPage>
  )
}
