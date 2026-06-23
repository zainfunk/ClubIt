import type { NextConfig } from "next";

// W3.1 — Security headers (see docs/security/ClubIt-Security-Assessment.md).
//
// CSP is shipped initially as `Content-Security-Policy-Report-Only` so we can
// observe violations in production without breaking the app on first deploy.
// TODO(W3.1): wire `/api/csp-report` to receive `report-uri` POSTs and surface
//             reports somewhere the security team can triage them.
// TODO(W3.1): remove `-Report-Only` after one deploy cycle of clean CSP reports
//             (i.e. flip `Content-Security-Policy-Report-Only` -> `Content-Security-Policy`).
//
// Notes:
// - script-src intentionally OMITS 'unsafe-inline'. Modern Next.js (16.x) does
//   not require inline <script> for the runtime; if a future dev-mode-only
//   regression breaks this, document it here and consider adding 'unsafe-inline'
//   guarded behind `process.env.NODE_ENV === 'development'`.
// - style-src DOES allow 'unsafe-inline' because Next.js' streaming/CSS-in-JS
//   pipeline still emits inline <style> tags without nonces.
// - geolocation=(self) is intentionally permitted: the QR check-in flow uses it.
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + Clerk (incl. clerk.clubit.app custom domain) + Stripe + Vercel preview/live. No 'unsafe-inline'.
  "script-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.clubit.app https://js.stripe.com https://*.stripe.com https://vercel.live https://*.vercel.live",
  // Workers: explicit so blob: URLs (Next.js webpack/HMR workers, Clerk web workers) don't fall back to script-src.
  "worker-src 'self' blob:",
  // Styles: 'unsafe-inline' is currently required by Next.js' style pipeline.
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data: (favicons, inlined SVGs) + Clerk avatars + Supabase storage + Stripe.
  "img-src 'self' data: blob: https://*.clerk.com https://*.clerk.accounts.dev https://clerk.clubit.app https://*.supabase.co https://*.stripe.com",
  // Fonts.
  "font-src 'self' data:",
  // XHR / fetch / websockets: Clerk (incl. custom domain), Supabase (incl. realtime wss), Stripe.
  "connect-src 'self' https://clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.clubit.app https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://vercel.live https://*.vercel.live wss://*.vercel.live",
  // Frames: allow Stripe (3DS / Checkout iframes), Clerk (CAPTCHA / hosted UI / custom domain), Vercel live preview.
  "frame-src 'self' https://js.stripe.com https://*.stripe.com https://*.clerk.com https://*.clerk.accounts.dev https://clerk.clubit.app https://vercel.live https://*.vercel.live",
  // Hard deny clickjacking — supersedes X-Frame-Options on modern browsers.
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // `upgrade-insecure-requests` is intentionally omitted: browsers ignore it in
  // a Report-Only policy (and warn). Re-add it when this header flips to enforcing.
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  {
    // Report-only on first deploy; flip to Content-Security-Policy after a
    // clean reporting cycle (see TODO at top of file).
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives,
  },
  {
    // 2 years, include subdomains, eligible for the HSTS preload list.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Legacy clickjacking defense; redundant with frame-ancestors but cheap.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Block MIME sniffing.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Don't leak full URLs cross-origin.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Geolocation kept enabled for self (QR check-in flow). Camera/mic disabled.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
