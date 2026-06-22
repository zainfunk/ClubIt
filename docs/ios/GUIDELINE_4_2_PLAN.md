# Guideline 4.2 — Minimum Functionality (anti-"wrapped website")

Guideline 4.2 is the biggest rejection risk for a Capacitor app: Apple
rejects apps that are "a repackaged website" with no native capability.
ClubIt loads its Next.js app from `clubit.vercel.app` in a WKWebView
(`server.url` in `capacitor.config.ts`), which is exactly the pattern
reviewers scrutinize. The mitigation is to (a) never present as a
marketing site, and (b) add genuine native capabilities.

## Done in this repo

- **No marketing site in the app.** Native users never see the public
  landing/pricing page; they enter at sign-in → dashboard.
  `app/page.tsx` and `app/landing/page.tsx` redirect the native
  user-agent to `/sign-in` / `/dashboard`.
- **Branded native splash** held until the web layer mounts, then hidden
  from `NativeBootstrap` — no flash of a blank web page on cold start.
  (`capacitor.config.ts` SplashScreen + `components/NativeBootstrap.tsx`.)
- **Native shell behaviors** (`components/NativeBootstrap.tsx`):
  status-bar styling, keyboard resize, hardware/edge **back gesture**,
  and **deep-link routing** so a scanned QR / notification tap performs
  in-app navigation instead of a reload.
- **Offline support** already exists (`lib/offline-queue.ts`,
  `lib/realtime.ts`) — actions queue and flush when back online.
- **Device APIs in use**: geolocation for QR attendance check-in
  (`app/attend/page.tsx`).
- **In-app QR scanner** — `components/ScanCheckInButton.tsx` (surfaced on
  the dashboard for students/advisors) opens the in-app camera via
  `@capacitor-mlkit/barcode-scanning`, decodes the meeting QR, and routes
  to `/attend?t=...` without leaving the app. Native-only (renders nothing
  on web); the plugin is dynamically imported so it never enters the web
  bundle. **Still requires** `NSCameraUsageDescription` in Info.plist and
  a `npx cap sync ios` on the Mac to install the pod.
- **Haptics** — `lib/haptics.ts` (guarded `@capacitor/haptics` wrapper)
  fires success feedback on attendance check-in (`app/attend/page.tsx`)
  and vote cast (`app/elections/[id]/page.tsx`), and on a successful scan.

- **Push notifications — fully wired** (dormant until the APNs key exists).
  Client registration requests permission + registers the APNs token and POSTs
  it to the server (`lib/push-client.ts`, wired in
  `components/NativeBootstrap.tsx`); tokens are stored per-user
  (`device_push_tokens`, migration `0010`) via `app/api/push/register`; the
  sender (`lib/push-send.ts`) signs an ES256 provider JWT and delivers over
  APNs HTTP/2 (`sendPushToUser` / `sendPushToUsers` fan-out). Notification taps
  deep-link in-app. The sender no-ops safely until the `APNS_*` env vars are
  set, so all of the below is safe in prod today:
    - **New chat message** → other members of the club
      (`app/api/school/chat` → `notifyNewChatMessage`).
    - **Election opened** → everyone in the school
      (`app/api/school/elections` → `notifyElectionOpened`).
    - **New event posted** → the club's members
      (`app/api/school/clubs/[id]` `create_event` → `notifyNewEvent`).
    - **Event reminders (~24h before)** → the club's members, once per event,
      via the hourly `app/api/cron/event-reminders` job (`vercel.json` cron,
      migration `0012` `events.reminder_sent_at`, guarded by `CRON_SECRET`).
  All event-driven sends run in Next's `after()` so they never block the
  response (`lib/notify.ts`).

## Pending — do on the Mac (needs the native project + a device to test)

### 1. Activate push notifications

The code is done **and the send sites are now wired** (chat, election,
new event, and the 24h event-reminder cron — see the list above). To turn
it on: enroll in the Apple Developer Program, create an APNs Auth Key
(.p8) in the developer portal, add the Push Notifications capability in
Xcode, set `APNS_TEAM_ID` / `APNS_KEY_ID` / `APNS_AUTH_KEY` /
`APNS_BUNDLE_ID` / `APNS_PRODUCTION` in the server env, set `CRON_SECRET`
(for the reminder cron), and apply migrations `0010` + `0012`. No further
app code is required — the sender flips from no-op to live automatically
once the `APNS_*` vars are present.

## If Apple still pushes back

If a reviewer still calls it a web wrapper, the fallback is to **bundle
the web assets locally** instead of `server.url` remote-loading. That is
non-trivial for this app (full Next.js with API routes — not a static
export), so it's the last resort, after the native features above. With
the in-app QR scanner + haptics already shipped and push notifications as
the remaining option, the app has clear native functionality while keeping
the remote-rendered UI.
