/**
 * W1.2 — verify Clerk middleware protects authenticated routes after the
 * GHSA-vqx2-fgx2-5wq9 bypass was patched.
 *
 * The CVE allowed unauthenticated requests to reach routes that the
 * Clerk middleware was supposed to gate. This test sends bare HTTP
 * requests with no cookies / Authorization header to a sample of
 * authenticated routes and asserts that the middleware rejects them
 * (redirect for HTML pages, 401 JSON for API routes).
 *
 * Closes finding C-2 from docs/security/ClubIt-Security-Assessment.md.
 *
 * Run with: BASE_URL=https://your-deploy.vercel.app npm run test:e2e --
 *   tests/security/browser/test_w1_2_auth_protection.spec.ts
 *
 * Or against local dev: `npm run dev` in another terminal, then run the test.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'

const PROTECTED_PAGES = [
  '/dashboard',
  '/admin',
  '/admin/billing',
  '/clubs',
  '/profile',
  '/settings',
  '/superadmin',
]

const PROTECTED_API_ROUTES = [
  { method: 'GET',  path: '/api/school/clubs' },
  { method: 'GET',  path: '/api/school/dashboard' },
  { method: 'GET',  path: '/api/school/notifications' },
  { method: 'GET',  path: '/api/school/elections' },
  { method: 'GET',  path: '/api/superadmin/schools' },
  { method: 'GET',  path: '/api/user/profile' },
  { method: 'GET',  path: '/api/user/sync' },
  { method: 'POST', path: '/api/checkout' },
  { method: 'POST', path: '/api/stripe/checkout' },
]

test.describe('W1.2: middleware protects authenticated surfaces', () => {
  for (const path of PROTECTED_PAGES) {
    test(`HTML ${path} requires auth`, async ({ baseURL }) => {
      const ctx = await playwrightRequest.newContext({ baseURL, ignoreHTTPSErrors: true })
      // Follow redirects (default). The bypass would manifest as a 200
      // response showing the authenticated page content; the patched
      // middleware lands the user on /sign-in (possibly after hops).
      const res = await ctx.get(path, { failOnStatusCode: false })
      const finalUrl = res.url()
      const body = await res.text()
      const landedOnSignIn = /\/sign[- ]?in/i.test(finalUrl) || /sign[- ]?in|clerk/i.test(body)
      expect(
        landedOnSignIn,
        `${path}: final URL ${finalUrl} status ${res.status()} did not show sign-in UI — possible bypass`,
      ).toBe(true)
      await ctx.dispose()
    })
  }

  for (const { method, path } of PROTECTED_API_ROUTES) {
    test(`API ${method} ${path} returns 401 unauthenticated`, async ({ baseURL }) => {
      const ctx = await playwrightRequest.newContext({ baseURL, ignoreHTTPSErrors: true })
      const res = method === 'GET'
        ? await ctx.get(path, { failOnStatusCode: false })
        : await ctx.post(path, { failOnStatusCode: false, data: {} })
      // The middleware (proxy.ts) explicitly returns 401 JSON for /api/*.
      expect(res.status(), `${method} ${path}`).toBe(401)
      const body = await res.json().catch(() => ({}))
      expect(body.error?.toLowerCase?.() ?? '').toContain('unauthorized')
      await ctx.dispose()
    })
  }
})
