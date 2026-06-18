# Sign in with Apple (App Store Guideline 4.8)

## The rule

Guideline 4.8: if the app **offers any third-party or social login**
(Google, Facebook, Microsoft, etc.) to set up or authenticate an
account, it must **also** offer at least one login option that:

- limits data collection to the user's name and email,
- lets the user keep their email private, and
- does not track them for advertising without consent.

**Sign in with Apple satisfies this** and is the simplest way to comply.
Plain email/password also qualifies (no third party involved).

## Where ClubIt stands

- Auth UI is Clerk's `<SignIn />` / `<SignUp />`
  (`app/sign-in/[[...sign-in]]/page.tsx`, `app/sign-up/[[...sign-up]]/page.tsx`).
  These render whatever sign-in methods are enabled in the **Clerk
  Dashboard** — there is no provider list hard-coded in our code.
- **Therefore the code is already compliant-ready**: enabling Apple in
  the Clerk Dashboard makes the "Sign in with Apple" button appear with
  no code change.

### Decision matrix

| Clerk Dashboard config | 4.8 obligation |
|---|---|
| Email/password (or email code) only, no social | **Nothing to do** — already privacy-friendly. |
| Google (or any social) enabled | **Must enable Sign in with Apple** too. |

Action: before submitting, open Clerk Dashboard → **User & Authentication
→ Social Connections** and check what's enabled. If any social provider
is on, enable Apple.

## Enabling Sign in with Apple in Clerk (when ready)

This step needs the **Apple Developer Program** ($99/yr), which we don't
have yet — so it's deferred until enrollment.

1. Apple Developer → Certificates, Identifiers & Profiles:
   - Create/confirm the App ID `com.clubit.app` with **Sign In with
     Apple** capability enabled.
   - Create a **Services ID** (e.g. `com.clubit.app.web`) for the web
     OAuth flow, enable Sign In with Apple on it, and set the return URL
     / domain that Clerk gives you.
   - Create a **Sign in with Apple key (.p8)** and note the Key ID +
     Team ID.
2. Clerk Dashboard → Social Connections → **Apple** → enter the Services
   ID, Team ID, Key ID, and the `.p8` private key. Use Clerk's callback
   URL as the Apple return URL.
3. For the **native iOS** app, Sign in with Apple uses the native
   capability. Add the **Sign In with Apple** capability to the Xcode
   target (`ios/App`) once the native project exists (see
   `docs/ios/APP_STORE_READINESS.md`). Capacitor can use
   `@capacitor-community/apple-sign-in` or rely on Clerk's web flow
   inside the WebView; prefer the native capability for the best review
   outcome.

## Recommended posture for a schools product

Keep **email/password (or email one-time-code) as the primary method**.
It is privacy-friendly and inherently 4.8-compliant. Add Apple (and
optionally Google) as conveniences. Avoid Facebook for a minors'
product.
