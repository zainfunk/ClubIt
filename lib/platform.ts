// Platform detection for the Capacitor iOS shell.
//
// ClubIt ships as a Next.js web app AND as a Capacitor WebView wrapper for iOS.
// Apple's App Store Review Guideline 3.1.1 bans collecting payment for digital
// subscriptions through anything other than Apple In-App Purchase. ClubIt bills
// schools through Stripe, so on the native build we hide every purchase /
// pricing / billing-management surface. Schools subscribe on the web instead.
//
// Detection works two ways so it covers both client and server components:
//   - Client: Capacitor's runtime flag (Capacitor.isNativePlatform()).
//   - Server: the WKWebView user-agent carries the token we append in
//     capacitor.config.ts (`appendUserAgent`), which we read off the request.

// Keep in sync with `appendUserAgent` in capacitor.config.ts.
export const NATIVE_APP_UA_TOKEN = 'ClubItNativeApp'

/**
 * Detect the native app from a user-agent string. Safe to call anywhere
 * (server components, route handlers, middleware/proxy, client).
 */
export function isNativeUserAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && userAgent.includes(NATIVE_APP_UA_TOKEN)
}
