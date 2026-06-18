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

## Pending — do on the Mac (needs the native project + a device to test)

### 1. In-app QR scanner (highest-value native feature) — RECOMMENDED

Today a student checks in by scanning a meeting QR with the OS camera,
which opens `/attend?t=<token>`. In the app, add a **"Scan to check in"**
button that opens the camera in-app, decodes the QR, and navigates to
`/attend?t=<token>`. This is a concrete native capability reviewers
recognize and ties directly to a core feature.

Recommended plugin: `@capacitor-mlkit/barcode-scanning` (or
`@capacitor-community/barcode-scanner`). Sketch:

```ts
// guarded behind Capacitor.isNativePlatform()
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'

async function scanCheckIn(router) {
  const { barcodes } = await BarcodeScanner.scan()
  const url = barcodes[0]?.rawValue
  if (!url) return
  const path = new URL(url).pathname + new URL(url).search // /attend?t=...
  router.push(path)
}
```

Requires `NSCameraUsageDescription` in Info.plist (see
`APP_STORE_READINESS.md`). Surface the button on the dashboard / a club
page for students.

### 2. Push notifications (strong secondary native signal)

Wire `@capacitor/push-notifications` for chat mentions, event reminders,
and election openings. Register the APNs token, store it per user, send
via a server route. Also a genuine native capability for 4.2.

### 3. Haptics on key actions

`@capacitor/haptics` (already installed) on check-in success, vote cast,
etc. — small, but adds to the native feel.

## If Apple still pushes back

If a reviewer still calls it a web wrapper, the fallback is to **bundle
the web assets locally** instead of `server.url` remote-loading. That is
non-trivial for this app (full Next.js with API routes — not a static
export), so it's the last resort, after the native features above. The
realistic, lower-effort path is items 1–3, which give the app clear
native functionality while keeping the remote-rendered UI.
