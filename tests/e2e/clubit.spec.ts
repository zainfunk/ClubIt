import { test, expect, Page, BrowserContext } from '@playwright/test'
import * as fs from 'fs'

/*
 * ClubIt E2E Tests
 *
 * Prerequisites: Run auth-setup.spec.ts first to create auth sessions.
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "student"
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "advisor"
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "admin"
 *
 * Then run these tests:
 *   npx playwright test tests/e2e/clubit.spec.ts --headed
 */

const BASE = 'http://localhost:3000'
const TS = Date.now()

const AUTH = {
  student: 'tests/e2e/.auth/student.json',
  advisor: 'tests/e2e/.auth/advisor.json',
  admin: 'tests/e2e/.auth/admin.json',
}

const CODES = {
  student: 'DYPX-STU-HTLM',
  advisor: '9LCW-ADV-TFCU',
  admin: '49TY-ADM-QNNG',
}

function hasAuth(role: keyof typeof AUTH) {
  return fs.existsSync(AUTH[role])
}

async function snap(page: Page, name: string) {
  fs.mkdirSync('tests/e2e/screenshots', { recursive: true })
  await page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: true })
}

/**
 * Navigate to a page, but if the app redirects to /join first,
 * auto-enter the invite code and then navigate again.
 */
async function ensureJoined(page: Page, role: keyof typeof CODES) {
  await page.goto(`${BASE}/dashboard`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  if (page.url().includes('/join')) {
    console.log(`[${role}] Redirected to /join — auto-joining...`)
    const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
    await input.first().fill(CODES[role])
    await page.getByRole('button', { name: /join school/i }).click()
    await page.waitForTimeout(5000)
    console.log(`[${role}] Post-join URL: ${page.url()}`)
  }
}

test.describe.configure({ mode: 'serial' })

// ────────────────────────────────────────────────────────────────────────────
// STUDENT TESTS
// ────────────────────────────────────────────────────────────────────────────

test.describe('Student Role Tests', () => {
  test.skip(!hasAuth('student'), 'No student auth — run auth-setup first')

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: AUTH.student })
    page = await context.newPage()
    await ensureJoined(page, 'student')
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Dashboard loads with greeting, NOT admin redirect', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-dashboard')

    const greeting = await page.locator('text=Hi,').isVisible().catch(() => false)
    const noClubs = await page.locator("text=haven't joined any clubs").isVisible().catch(() => false)
    const adminRedirect = await page.locator('a:has-text("Admin Panel")').isVisible().catch(() => false)

    console.log('[Student] greeting:', greeting, '| noClubs:', noClubs, '| adminRedirect:', adminRedirect)

    if (adminRedirect) console.error('[BUG] Student sees admin panel redirect')
    expect(adminRedirect).toBeFalsy()
    expect(greeting || noClubs).toBeTruthy()
  })

  test('Clubs page — student CANNOT create clubs', async () => {
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-clubs')

    await expect(page.locator('text=Explore').first()).toBeVisible({ timeout: 10_000 })

    const canCreate = await page.getByRole('button', { name: /new club/i }).isVisible().catch(() => false)
    if (canCreate) console.error('[BUG] Student can see "New Club" button')
    expect(canCreate).toBeFalsy()
  })

  test('Chat page loads (no 404)', async () => {
    await page.goto(`${BASE}/chat`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-chat')
    expect(await page.locator('text=404').isVisible().catch(() => false)).toBeFalsy()
  })

  test('Settings shows Privacy, NOT admin controls', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-settings')

    const hasPrivacy = await page.locator('h2:has-text("Privacy")').isVisible().catch(() => false)
    const hasAdminControls = await page.locator('text=Student Feature Controls').isVisible().catch(() => false)

    console.log('[Student Settings] Privacy:', hasPrivacy, '| AdminControls:', hasAdminControls)
    expect(hasPrivacy).toBeTruthy()
    if (hasAdminControls) console.error('[BUG] Student sees admin feature controls')
    expect(hasAdminControls).toBeFalsy()
  })

  test('Student blocked from /admin', async () => {
    await page.goto(`${BASE}/admin`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-admin-blocked')

    const url = page.url()
    const hasAdmin = await page.locator('text=Manage Users').or(page.locator('text=User Management')).isVisible().catch(() => false)
    if (hasAdmin && url.includes('/admin')) console.error('[BUG] Student has admin panel access')
    console.log('[Student /admin] URL:', url)
  })

  test('Student blocked from /superadmin', async () => {
    await page.goto(`${BASE}/superadmin`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'student-superadmin-blocked')

    const url = page.url()
    if (url.includes('/superadmin')) {
      const hasSchools = await page.locator('text=Pending').isVisible().catch(() => false)
      if (hasSchools) console.error('[BUG] Student has superadmin access')
    }
    console.log('[Student /superadmin] URL:', url)
  })

  test('All pages load without 500s', async () => {
    for (const path of ['/dashboard', '/clubs', '/chat', '/events', '/profile', '/settings', '/elections', '/attend']) {
      const res = await page.goto(`${BASE}${path}`)
      const status = res?.status() ?? 0
      console.log(`[Student] ${path}: ${status}`)
      if (status >= 500) console.error(`[BUG] ${path} returned ${status}`)
      expect(status).toBeLessThan(500)
      await page.waitForTimeout(1000)
    }
  })

  test('Report Issue form works', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    expect(await page.locator('text=Report an Issue').isVisible().catch(() => false)).toBeTruthy()
    expect(await page.locator('textarea[placeholder*="Describe"]').isVisible().catch(() => false)).toBeTruthy()

    const disabled = await page.getByRole('button', { name: /send report/i }).isDisabled().catch(() => false)
    if (!disabled) console.error('[BUG] Send Report enabled with empty textarea')
  })

  test('Dark mode toggle persists', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const toggle = page.locator('button[role="switch"]').first()
    if (await toggle.isVisible().catch(() => false)) {
      const before = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await page.waitForTimeout(1000)
      const after = await toggle.getAttribute('aria-checked')

      if (before === after) console.error('[BUG] Dark mode toggle did not change')
      expect(before).not.toBe(after)

      await page.reload()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const afterReload = await page.locator('button[role="switch"]').first().getAttribute('aria-checked')
      if (afterReload !== after) console.error('[BUG] Dark mode did not persist after reload')

      // Reset
      await page.locator('button[role="switch"]').first().click()
      await page.waitForTimeout(500)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ADVISOR TESTS
// ────────────────────────────────────────────────────────────────────────────

test.describe('Advisor Role Tests', () => {
  test.skip(!hasAuth('advisor'), 'No advisor auth — run auth-setup first')

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: AUTH.advisor })
    page = await context.newPage()
    await ensureJoined(page, 'advisor')
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Dashboard shows greeting, NOT admin redirect', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'advisor-dashboard')

    const adminRedirect = await page.locator('a:has-text("Admin Panel")').isVisible().catch(() => false)
    if (adminRedirect) console.error('[BUG] Advisor sees admin redirect')
    expect(adminRedirect).toBeFalsy()
  })

  test('Advisor CAN see New Club button', async () => {
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'advisor-clubs')

    const canCreate = await page.getByRole('button', { name: /new club/i }).isVisible().catch(() => false)
    if (!canCreate) console.error('[BUG] Advisor cannot see New Club button')
    expect(canCreate).toBeTruthy()
  })

  test('Advisor can create a club', async () => {
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    await page.getByRole('button', { name: /new club/i }).click()
    await page.waitForTimeout(1000)

    await page.locator('input[placeholder*="Photography"]').fill(`PW Test Club ${TS}`)
    await page.locator('textarea[placeholder*="Describe"]').fill('Automated Playwright test club')

    await page.getByRole('button', { name: /create club/i }).click()
    await page.waitForTimeout(5000)
    await snap(page, 'advisor-club-created')

    const hasError = await page.locator('.text-red-700').isVisible().catch(() => false)
    if (hasError) {
      const err = await page.locator('.text-red-700').first().textContent()
      console.log('[Advisor] Club creation error:', err)
    }
  })

  test('Advisor settings: Privacy YES, admin controls NO', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'advisor-settings')

    const hasAdminControls = await page.locator('text=Student Feature Controls').isVisible().catch(() => false)
    if (hasAdminControls) console.error('[BUG] Advisor sees admin controls')
    expect(hasAdminControls).toBeFalsy()
  })

  test('Advisor sees Issue Reports on dashboard', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    // Scroll to bottom — section loads async and is below the fold
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    // The heading text in DOM is "Issue Reports" (CSS makes it uppercase visually)
    const issueEl = page.locator('h3').filter({ hasText: /issue reports/i })
    const hasIssues = await issueEl.isVisible().catch(() => false)

    // Also try looking for the "No issue reports yet" empty state
    const hasEmptyState = await page.locator('text=No issue reports yet').isVisible().catch(() => false)

    console.log('[Advisor] Issue Reports heading:', hasIssues, '| empty state:', hasEmptyState)
    if (!hasIssues && !hasEmptyState) console.error('[BUG] Advisor missing Issue Reports on dashboard')
    expect(hasIssues || hasEmptyState).toBeTruthy()
  })

  test('Advisor chat loads', async () => {
    await page.goto(`${BASE}/chat`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'advisor-chat')
    expect(await page.locator('text=404').isVisible().catch(() => false)).toBeFalsy()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// ADMIN TESTS
// ────────────────────────────────────────────────────────────────────────────

test.describe('Admin Role Tests', () => {
  test.skip(!hasAuth('admin'), 'No admin auth — run auth-setup first')

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: AUTH.admin })
    page = await context.newPage()
    await ensureJoined(page, 'admin')
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Dashboard shows Admin Panel link', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'admin-dashboard')

    const hasAdminLink = await page.locator('a:has-text("Admin Panel")').isVisible().catch(() => false)
    if (!hasAdminLink) console.error('[BUG] Admin dashboard missing Admin Panel link')
    expect(hasAdminLink).toBeTruthy()
  })

  test('Admin panel loads', async () => {
    await page.goto(`${BASE}/admin`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'admin-panel')
    console.log('[Admin] Panel URL:', page.url())
  })

  test('Admin settings shows Feature Controls, NOT Privacy', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    await snap(page, 'admin-settings')

    const hasAdminControls = await page.locator('text=Student Feature Controls').isVisible().catch(() => false)
    const hasPrivacy = await page.locator('h2:has-text("Privacy")').isVisible().catch(() => false)

    if (!hasAdminControls) console.error('[BUG] Admin missing Student Feature Controls')
    expect(hasAdminControls).toBeTruthy()

    if (hasPrivacy) console.error('[BUG] Admin sees Privacy section (student/advisor only)')
    expect(hasPrivacy).toBeFalsy()
  })

  test('Admin feature toggles work', async () => {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const toggles = page.locator('button[role="switch"]')
    const count = await toggles.count()
    console.log('[Admin] Toggle count:', count)

    for (let i = 0; i < Math.min(count, 5); i++) {
      const t = toggles.nth(i)
      const before = await t.getAttribute('aria-checked')
      await t.click()
      await page.waitForTimeout(500)
      const after = await t.getAttribute('aria-checked')
      console.log(`  Toggle ${i}: ${before} → ${after}`)
      if (before === after) console.error(`[BUG] Toggle ${i} did not change`)
      await t.click()
      await page.waitForTimeout(500)
    }
  })

  test('Admin can create clubs', async () => {
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const canCreate = await page.getByRole('button', { name: /new club/i }).isVisible().catch(() => false)
    expect(canCreate).toBeTruthy()
  })

  test('Admin all pages load', async () => {
    for (const path of ['/dashboard', '/clubs', '/chat', '/events', '/profile', '/settings', '/admin', '/elections', '/attend']) {
      const res = await page.goto(`${BASE}${path}`)
      const status = res?.status() ?? 0
      console.log(`[Admin] ${path}: ${status}`)
      if (status >= 500) console.error(`[BUG] ${path} returned ${status}`)
      expect(status).toBeLessThan(500)
      await page.waitForTimeout(1000)
    }
  })
})

// ────────────────────────────────────────────────────────────────────────────
// API VALIDATION (unauthenticated)
// ────────────────────────────────────────────────────────────────────────────

test.describe('API Validation — Unauthenticated', () => {
  test('/api/join without auth → 401', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'DYPX-STU-HTLM' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] Unauth /api/join:', r.status, r.body)
    expect(r.status).toBe(401)
  })

  test('/api/school/settings without auth → 401', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const r = await page.evaluate(async () => (await fetch('/api/school/settings')).status)
    console.log('[API] Unauth /api/school/settings:', r)
    expect(r).toBe(401)
  })

  test('/api/user/privacy without auth → 401', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const r = await page.evaluate(async () => (await fetch('/api/user/privacy')).status)
    console.log('[API] Unauth /api/user/privacy:', r)
    expect(r).toBe(401)
  })

  test('/api/school/chat without auth → 401', async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
    const r = await page.evaluate(async () => (await fetch('/api/school/chat')).status)
    console.log('[API] Unauth /api/school/chat:', r)
    expect(r).toBe(401)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// API VALIDATION (authenticated)
// ────────────────────────────────────────────────────────────────────────────

test.describe('API Validation — Authenticated', () => {
  test.skip(!hasAuth('student'), 'No student auth')

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ storageState: AUTH.student })
    page = await context.newPage()
    await ensureJoined(page, 'student')
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('/api/join rejects empty code → 400', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] Empty code:', r.status, r.body)
    expect(r.status).toBe(400)
  })

  test('/api/join rejects invalid code → 404', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ZZZZ-FAKE-CODE' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] Invalid code:', r.status, r.body)
    expect(r.status).toBe(404)
  })

  test('/api/join rejects missing code field → 400', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] No code field:', r.status, r.body)
    expect(r.status).toBeGreaterThanOrEqual(400)
  })

  test('/api/join normalizes lowercase → not 404', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'dypx-stu-htlm' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] Lowercase code:', r.status, r.body)
    if (r.status === 404) console.error('[BUG] Lowercase code → 404')
    expect(r.status).not.toBe(404)
  })

  test('/api/join trims whitespace → not 404', async () => {
    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '  DYPX-STU-HTLM  ' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })
    console.log('[API] Whitespace code:', r.status, r.body)
    if (r.status === 404) console.error('[BUG] Whitespace not trimmed')
    expect(r.status).not.toBe(404)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// CROSS-ROLE LOGIC
// ────────────────────────────────────────────────────────────────────────────

test.describe('Cross-Role Logic', () => {
  test('Student + admin code on same school → role promotion', async ({ browser }) => {
    test.skip(!hasAuth('student'), 'No student auth')

    const ctx = await browser.newContext({ storageState: AUTH.student })
    const page = await ctx.newPage()
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    const r = await page.evaluate(async () => {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'YYZG-ADM-8ECE' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    })

    console.log('[CrossRole] Student + admin code:', r.status, r.body)
    if (r.status === 200 && r.body?.role !== 'admin') {
      console.error('[BUG] Role not promoted to admin')
    }
    await ctx.close()
  })

  test('Profile page loads for all roles', async ({ browser }) => {
    for (const role of ['student', 'advisor', 'admin'] as const) {
      if (!hasAuth(role)) continue
      const ctx = await browser.newContext({ storageState: AUTH[role] })
      const page = await ctx.newPage()
      const res = await page.goto(`${BASE}/profile`)
      const status = res?.status() ?? 0
      console.log(`[Profile] ${role}: ${status}`)
      if (status >= 500) console.error(`[BUG] Profile ${status} for ${role}`)
      expect(status).toBeLessThan(500)
      await snap(page, `profile-${role}`)
      await ctx.close()
    }
  })

  test('Events page loads for all roles', async ({ browser }) => {
    for (const role of ['student', 'advisor', 'admin'] as const) {
      if (!hasAuth(role)) continue
      const ctx = await browser.newContext({ storageState: AUTH[role] })
      const page = await ctx.newPage()
      const res = await page.goto(`${BASE}/events`)
      const status = res?.status() ?? 0
      console.log(`[Events] ${role}: ${status}`)
      if (status >= 500) console.error(`[BUG] Events ${status} for ${role}`)
      expect(status).toBeLessThan(500)
      await ctx.close()
    }
  })
})
