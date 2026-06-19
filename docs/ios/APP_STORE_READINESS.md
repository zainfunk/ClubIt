# iOS / App Store readiness

Status of the work needed to ship ClubIt to the App Store. Code-side
compliance items are tracked here and in the sibling docs. The remaining
"needs a Mac + Apple Developer account" steps are called out explicitly.

## Prerequisites (you, when ready)

- **Apple Developer Program** — $99/yr. Required to sign, run on device,
  use Sign in with Apple, and submit. *(Not yet enrolled.)*
- **A Mac with Xcode 16** — required to add the iOS platform, build, and
  archive. Codemagic's cloud Mac (`codemagic.yaml`) can also build, but
  you still need the Developer account + signing assets.

## One-time native project setup (on the Mac)

The `ios/` native project is **not** committed (it doesn't exist yet).
On the Mac:

```bash
npm ci
npx cap add ios          # generates ios/App + runs pod install (needs CocoaPods)
APP_SERVER_URL=https://clubit.vercel.app npx cap sync ios
npx cap open ios         # opens Xcode
```

> Do not run `cap add ios` on Windows — `pod install` needs CocoaPods/macOS
> and will leave a half-created `ios/` folder.

### Info.plist — required usage strings (ADD THESE)

iOS **crashes on launch of the feature** (= automatic rejection) if a
permission is requested without a usage string. ClubIt uses the camera
(QR scanning) and location (QR attendance check-in), so add to
`ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>ClubIt uses the camera so you can scan a club's QR code to check in to a meeting.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>ClubIt uses your location only when you check in to a club meeting, to confirm you're at the meeting.</string>
```

(If photo upload for avatars is enabled in the native build, also add
`NSPhotoLibraryUsageDescription`.)

### App icons

`scripts/generate-icons.mjs` produces the web/PWA PNGs and a
`public/icons/icon-1024.png` App Store master (opaque, no alpha — Apple
rejects alpha in the marketing icon). In Xcode, drop the generated sizes
into `Assets.xcassets/AppIcon.appiconset` (or use a tool like
`cordova-res` / `@capacitor/assets` to generate the full set from
`icon-1024.png`):

```bash
npx @capacitor/assets generate --ios   # uses an icon source to fill the asset catalog
```

### Launch screen

Capacitor ships a default `LaunchScreen.storyboard`. Replace the default
white screen with the ClubIt mark / brand color (#4f46e5) so the cold
start doesn't look like a blank web page (helps Guideline 4.2).

## Code-side compliance — DONE in this repo

| Guideline | Item | Where |
|---|---|---|
| 3.1.1 | No Stripe purchase UI in the iOS app | `lib/platform.ts`, `lib/use-native-app.ts`, gated billing/subscribe/landing + payment API routes |
| 5.1.1(v) | In-app account deletion | `app/api/user/delete/route.ts`, `components/settings/DeleteAccountSection.tsx` |
| 1.2 | Chat content filter + report + block + admin action + EULA | `lib/content-filter.ts`, `app/api/school/chat/*`, `app/admin/moderation`, `TERMS.md` |
| 5.1.x | No third-party trackers; Clerk telemetry off | `docs/security/MINORS_PRIVACY.md`, `app/layout.tsx` |
| 4.8 | Sign in with Apple readiness | `docs/ios/SIGN_IN_WITH_APPLE.md` |
| 4.2 | Native capabilities beyond a web wrapper | `docs/ios/GUIDELINE_4_2_PLAN.md` |
| 4.2 | In-app QR scanner for check-in | `components/ScanCheckInButton.tsx` (dashboard) |
| 4.2 | Haptics on check-in / vote | `lib/haptics.ts`, `app/attend`, `app/elections/[id]` |
| HIG | Safe-area insets (notch/Dynamic Island), 44pt touch targets, full mobile nav | `TopBar.tsx`, `MobileTabBar.tsx`, `Navbar.tsx`, `globals.css` |

### Database migrations to apply before/with the iOS release

These are additive and idempotent but **must be applied** (they back the
features above):

- `supabase/migrations/0008_account_self_deletion.sql` — `users.deleted_at`
- `supabase/migrations/0009_chat_moderation.sql` — reports + blocks tables

## App Store Connect (you, at submission)

1. Create the app record with bundle ID `com.clubit.app`.
2. **App Privacy labels** — see `docs/security/MINORS_PRIVACY.md` (Contact
   Info + User Content for App Functionality; no tracking, no ads).
3. **Age rating** questionnaire — note the user-to-user chat.
4. **Privacy policy URL** — published `PRIVACY_POLICY.md`.
5. **Review notes + demo account** — provide a working *student* demo
   login so the reviewer can test chat, report, block, and account
   deletion. (A demo school already exists in-app.)
6. Screenshots for required device sizes.
7. List under **Education**, not the Kids Category (see MINORS_PRIVACY).

## Known gaps still open

- `ios/` native project not generated (needs Mac) — biggest remaining
  mechanical step.
- Sign in with Apple Dashboard/Apple config (needs Developer account).
- See `docs/ios/GUIDELINE_4_2_PLAN.md` for native-capability work.
