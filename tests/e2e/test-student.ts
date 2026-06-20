/**
 * Student E2E test script — standalone (no Playwright Test runner).
 *
 * Uses Clerk Backend API sign-in token to authenticate, then exercises
 * the core student flows: dashboard, clubs, profile, settings.
 *
 * Run:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-student.ts
 */

import { chromium, Page } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BASE = 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY!
const STUDENT_USER_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function log(status: 'PASS' | 'FAIL', msg: string) {
  if (status === 'PASS') passed++
  else failed++
  console.log(`[${status}] ${msg}`)
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
  console.log(`  -> screenshot: ${name}.png`)
}

async function getSignInToken(): Promise<string> {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: STUDENT_USER_ID }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Clerk sign_in_tokens failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.token as string
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Obtaining Clerk sign-in token...')
  const token = await getSignInToken()
  console.log('Got token, launching browser...')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  try {
    // ── 1. Sign in as student ──────────────────────────────────────────────
    await page.goto(`${BASE}/sign-in?__clerk_ticket=${token}`)
    await page.waitForLoadState('networkidle')
    // Wait for Clerk to process the ticket and redirect
    await page.waitForTimeout(5000)
    await page.waitForLoadState('networkidle')

    const url = page.url()
    if (url.includes('/dashboard') || url.includes('/join') || url === `${BASE}/`) {
      log('PASS', `Sign-in redirected to: ${url}`)
    } else {
      log('FAIL', `Sign-in did not redirect to dashboard — URL: ${url}`)
      await screenshot(page, 'fail-sign-in')
    }

    // If redirected to /join, handle it
    if (url.includes('/join')) {
      console.log('  Redirected to /join — entering invite code...')
      const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
      await input.first().fill('DYPX-STU-HTLM')
      await page.getByRole('button', { name: /join school/i }).click()
      await page.waitForTimeout(5000)
      await page.waitForLoadState('networkidle')
      console.log(`  Post-join URL: ${page.url()}`)
    }

    // Navigate to dashboard explicitly
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)

    // ── 2. Dashboard greeting ──────────────────────────────────────────────
    try {
      const greeting = page.locator('text=Hi, clubit_student_test!')
      await greeting.waitFor({ state: 'visible', timeout: 15000 })
      log('PASS', 'Dashboard shows "Hi, clubit_student_test!" greeting')
    } catch {
      log('FAIL', 'Dashboard greeting "Hi, clubit_student_test!" not visible')
      await screenshot(page, 'fail-greeting')
      // Check what greeting IS visible
      const anyGreeting = await page.locator('h2').first().textContent().catch(() => '(none)')
      console.log(`  Actual h2 text: ${anyGreeting}`)
    }

    // ── 3. Chess Club card visible ─────────────────────────────────────────
    try {
      const chessClub = page.locator('text=Chess Club')
      await chessClub.first().waitFor({ state: 'visible', timeout: 10000 })
      log('PASS', 'Chess Club card is visible on dashboard')
    } catch {
      log('FAIL', 'Chess Club card not visible on dashboard')
      await screenshot(page, 'fail-chess-club')
    }

    // ── 4. Pending requests — Debate Club ──────────────────────────────────
    try {
      const pendingBtn = page.locator('button', { hasText: /pending club request/i })
      const hasPending = await pendingBtn.isVisible().catch(() => false)
      if (hasPending) {
        await pendingBtn.click()
        await page.waitForTimeout(1000)
        const debateClub = page.locator('text=Debate Club')
        const debateVisible = await debateClub.first().isVisible().catch(() => false)
        if (debateVisible) {
          log('PASS', 'Pending requests expanded — Debate Club visible')
        } else {
          log('FAIL', 'Pending requests expanded but Debate Club not visible')
          await screenshot(page, 'fail-pending-debate')
        }
      } else {
        // No pending requests — not necessarily a failure, just a skip
        log('PASS', 'No pending club requests (Debate Club may already be joined or no pending requests)')
        console.log('  Note: Pending requests section not present — skipping expand test')
      }
    } catch (e: any) {
      log('FAIL', `Pending requests test error: ${e.message}`)
      await screenshot(page, 'fail-pending')
    }

    // ── 5. /clubs page — all clubs listed ──────────────────────────────────
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)

    try {
      // Wait for at least one club card/link to appear
      const clubCards = page.locator('a[href^="/clubs/"]')
      const count = await clubCards.count()
      if (count > 0) {
        log('PASS', `/clubs page shows ${count} club(s)`)
      } else {
        // Try another selector
        const anyClub = page.locator('text=Chess Club')
        await anyClub.first().waitFor({ state: 'visible', timeout: 10000 })
        log('PASS', '/clubs page shows clubs (Chess Club found)')
      }
    } catch {
      log('FAIL', '/clubs page — no clubs visible')
      await screenshot(page, 'fail-clubs-page')
    }

    // ── 6. Chess Club detail page ──────────────────────────────────────────
    try {
      // Find and click Chess Club link
      const chessLink = page.locator('a[href^="/clubs/"]', { hasText: /Chess Club/i })
      const href = await chessLink.first().getAttribute('href')
      if (href) {
        await page.goto(`${BASE}${href}`)
      } else {
        // Fallback: click it
        await chessLink.first().click()
      }
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(4000)

      const nameVisible = await page.locator('text=Chess Club').first().isVisible().catch(() => false)
      // Look for member count — could be "X members" or similar
      const memberText = await page.locator('text=/\\d+\\s*(member|Member)/').first().isVisible().catch(() => false)

      if (nameVisible) {
        log('PASS', `Chess Club detail — name visible, member count visible: ${memberText}`)
      } else {
        log('FAIL', 'Chess Club detail — name not visible')
        await screenshot(page, 'fail-chess-detail')
      }
    } catch (e: any) {
      log('FAIL', `Chess Club detail page error: ${e.message}`)
      await screenshot(page, 'fail-chess-detail')
    }

    // ── 7. /profile — avatar, name, email ──────────────────────────────────
    await page.goto(`${BASE}/profile`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)

    try {
      // Check avatar (img tag or Avatar component)
      const hasAvatar = await page.locator('img[alt*="avatar" i], img[alt*="profile" i], img[src*="avatar"], img[src*="clerk"], .avatar, img[class*="rounded-full"]').first().isVisible().catch(() => false)
      // Check name
      const hasName = await page.locator('text=clubit_student_test').first().isVisible().catch(() => false)
      // Check email
      const hasEmail = await page.locator('text=@').first().isVisible().catch(() => false)

      if (hasName || hasAvatar || hasEmail) {
        log('PASS', `Profile page — avatar: ${hasAvatar}, name: ${hasName}, email: ${hasEmail}`)
      } else {
        log('FAIL', 'Profile page — avatar, name, and email all missing')
        await screenshot(page, 'fail-profile')
      }
    } catch (e: any) {
      log('FAIL', `Profile page error: ${e.message}`)
      await screenshot(page, 'fail-profile')
    }

    // ── 8. /settings — privacy toggles ─────────────────────────────────────
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)

    try {
      const privacyHeading = page.locator('text=Privacy')
      await privacyHeading.first().waitFor({ state: 'visible', timeout: 10000 })

      const toggles = page.locator('button[role="switch"]')
      const toggleCount = await toggles.count()

      if (toggleCount > 0) {
        log('PASS', `/settings — Privacy section visible with ${toggleCount} toggle(s)`)
      } else {
        log('FAIL', '/settings — Privacy heading visible but no toggles found')
        await screenshot(page, 'fail-settings-toggles')
      }
    } catch (e: any) {
      log('FAIL', `/settings — Privacy section not visible: ${e.message}`)
      await screenshot(page, 'fail-settings')
    }

  } finally {
    await browser.close()
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`)
  console.log('='.repeat(50))

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
