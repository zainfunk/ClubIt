# Minors, privacy, and App Store kids requirements

ClubIt is used by students, including minors. Apple applies heightened
scrutiny to apps used by children (App Store Review Guidelines 1.3 and
5.1.4) and to the privacy of all users (5.1.1, 5.1.2). US schools also
bind us under FERPA / COPPA via the institutional agreement. This
document records the data-collection audit and our posture.

## Third-party tracking audit (2026-06-18)

Result: **no third-party analytics, advertising, or tracking SDKs.**

| Checked | Present? | Notes |
|---|---|---|
| Google Analytics / gtag / GTM | No | — |
| PostHog / Mixpanel / Amplitude / Segment | No | — |
| Sentry / Datadog / Hotjar / FullStory | No | — |
| Facebook / Meta pixel | No | — |
| Ad networks (AdMob, AppsFlyer, ads) | No | No ads anywhere in the app. |
| `@vercel/analytics` | No | Not a dependency. |
| Clerk SDK telemetry | **Disabled** | `telemetry={{ disabled: true }}` on `<ClerkProvider>` in `app/layout.tsx`. |
| Google Fonts (runtime calls) | No | `next/font/google` self-hosts fonts at build time; CSP `font-src 'self'`. |

The only `analytics` reference in the codebase is `@upstash/ratelimit`'s
internal rate-limit metric flag (`lib/rate-limit.ts`) — server-side
operational metrics, not user tracking.

How to keep this true:
- Do **not** add any analytics/ads/tracking SDK without revisiting this
  doc and the App Privacy labels. If product analytics is ever needed,
  prefer a first-party, self-hosted, PII-free approach and document it.

## What we collect (and why)

- **Identity:** name + email (via Clerk) to create the account and
  scope a user to their school.
- **School activity:** club memberships, attendance, chat messages,
  votes, XP — the core product function, owned by the school as
  education records.
- **No precise advertising identifiers.** Geolocation is requested only
  transiently for QR attendance check-in (`app/attend/page.tsx`) and is
  not stored as a tracking profile.

## Data subject controls

- **Account deletion** in-app (`Settings → Delete Account`) — see
  `app/api/user/delete/route.ts`.
- **Privacy toggles** for what peers can see (`app/settings`).
- **Block / report** in chat — see chat moderation.
- **School-mediated deletion / export** under FERPA — see
  `docs/security/DATA_DELETION.md`.

## App Store Connect actions (when submitting)

These are configuration steps in App Store Connect, not code:

1. **Age rating.** Complete the questionnaire honestly. ClubIt has
   unmoderated-in-real-time user chat between students; expect a 12+/17+
   age rating unless the chat is positioned as moderated. Confirm the
   final rating with the report/block/admin-action controls described in
   `TERMS.md`.
2. **Kids Category — recommended NOT to opt in.** The Kids Category
   (Guideline 1.3) forbids sending any personally identifiable info or
   device info to third parties and adds parental-gate requirements.
   ClubIt is a school tool, not a consumer kids app; list it under
   **Education** instead and rely on the school (the institution) as the
   responsible adult under FERPA. Document this decision if challenged.
3. **App Privacy "nutrition" labels.** Declare: Contact Info (name,
   email) linked to identity for App Functionality; User Content (chat,
   photos if any) for App Functionality. Declare **no** data used for
   Tracking and **no** Third-Party Advertising.
4. **Privacy policy URL.** Point to the published version of
   `docs/security/PRIVACY_POLICY.md`.
5. **Demo account.** Provide a working student demo login in the review
   notes so the reviewer can exercise chat, report, block, and delete.

## Open follow-ups

- <!-- TODO(legal): confirm whether any state student-privacy law (NY Ed
  Law 2-d, IL SOPPA, CA SOPIPA) imposes obligations beyond the
  institutional FERPA agreement for the iOS distribution channel. -->
- <!-- TODO(product): decide final age-rating positioning (moderated vs
  unmoderated chat) before first submission. -->
