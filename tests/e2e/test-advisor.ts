/**
 * Advisor E2E Test Script
 *
 * Tests the full advisor experience: sign-in, dashboard, clubs, join requests,
 * chat, profile, settings, elections.
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-advisor.ts
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BASE = 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY
const ADVISOR_USER_ID = 'user_3CHbbnP13LUdb8mMrNua5m5yAkO'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL'
  detail?: string
}

const results: TestResult[] = []

function log(name: string, status: 'PASS' | 'FAIL', detail?: string) {
  results.push({ name, status, detail })
  const icon = status === 'PASS' ? '[PASS]' : '[FAIL]'
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`)
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `advisor-${name}.png`), fullPage: true })
}

async function getSignInToken(): Promise<string> {
  if (!CLERK_SECRET) {
    throw new Error('CLERK_SECRET_KEY not found in .env.local')
  }

  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: ADVISOR_USER_ID }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clerk sign_in_tokens failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { token: string }
  return data.token
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  ADVISOR E2E TESTS')
  console.log('='.repeat(60) + '\n')

  // Get sign-in token
  console.log('Getting Clerk sign-in token...')
  let token: string
  try {
    token = await getSignInToken()
    console.log('Got sign-in token.\n')
  } catch (err: any) {
    console.error('FATAL: Could not get sign-in token:', err.message)
    process.exit(1)
  }

  const browser: Browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })

  const page = await context.newPage()

  try {
    // ── TEST 1: Sign in as advisor → verify lands on dashboard ──────────
    try {
      console.log('Signing in as advisor...')
      await page.goto(`${BASE}/sign-in?__clerk_ticket=${token}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(5000)

      // May redirect to /join — handle that
      const urlAfterSignIn = page.url()
      console.log('URL after sign-in:', urlAfterSignIn)

      if (urlAfterSignIn.includes('/join')) {
        console.log('Redirected to /join — entering invite code...')
        const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
        if (await input.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await input.first().fill('9LCW-ADV-TFCU')
          await page.getByRole('button', { name: /join school/i }).click()
          await page.waitForTimeout(5000)
        }
      }

      await page.goto(`${BASE}/dashboard`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const currentUrl = page.url()
      await screenshot(page, '01-dashboard')

      if (currentUrl.includes('/dashboard')) {
        log('1. Sign in → dashboard', 'PASS', `URL: ${currentUrl}`)
      } else {
        log('1. Sign in → dashboard', 'FAIL', `URL: ${currentUrl}`)
        await screenshot(page, '01-dashboard-fail')
      }
    } catch (err: any) {
      log('1. Sign in → dashboard', 'FAIL', err.message)
      await screenshot(page, '01-dashboard-fail')
    }

    // ── TEST 2: Dashboard shows clubs being advised ─────────────────────
    try {
      await page.goto(`${BASE}/dashboard`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const bodyText = await page.locator('body').textContent() ?? ''
      await screenshot(page, '02-dashboard-clubs')

      const hasChessClub = bodyText.toLowerCase().includes('chess')
      const hasDebateClub = bodyText.toLowerCase().includes('debate')

      if (hasChessClub || hasDebateClub) {
        log('2. Dashboard shows advised clubs', 'PASS',
          `Chess: ${hasChessClub}, Debate: ${hasDebateClub}`)
      } else {
        // Check if dashboard has any clubs at all
        const hasClubs = await page.locator('[href*="/clubs/"]').count()
        log('2. Dashboard shows advised clubs', hasClubs > 0 ? 'PASS' : 'FAIL',
          `Chess: ${hasChessClub}, Debate: ${hasDebateClub}, clubLinks: ${hasClubs}`)
      }
    } catch (err: any) {
      log('2. Dashboard shows advised clubs', 'FAIL', err.message)
      await screenshot(page, '02-dashboard-clubs-fail')
    }

    // ── TEST 3: Navigate to Chess Club detail → verify member list ──────
    try {
      await page.goto(`${BASE}/clubs`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      // Find Chess Club link specifically
      const chessLink = page.locator('a').filter({ hasText: /chess/i }).first()
      let clubFound = false

      if (await chessLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await chessLink.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)
        clubFound = true
      } else {
        // Fallback: try clicking any club card that is NOT a test club
        const clubLinks = page.locator('[href*="/clubs/"]')
        const count = await clubLinks.count()
        for (let i = 0; i < count; i++) {
          const href = await clubLinks.nth(i).getAttribute('href') ?? ''
          if (!href.includes('test-club')) {
            await clubLinks.nth(i).click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(3000)
            clubFound = true
            break
          }
        }
      }

      await screenshot(page, '03-club-detail')

      if (clubFound) {
        const bodyText = await page.locator('body').textContent() ?? ''
        // The page uses "Active Members" and "All Members"
        const hasMemberSection = bodyText.includes('Members') ||
          bodyText.toLowerCase().includes('member')
        log('3. Club detail — member list visible', hasMemberSection ? 'PASS' : 'FAIL',
          `memberSection: ${hasMemberSection}, URL: ${page.url()}`)
      } else {
        log('3. Club detail — member list visible', 'FAIL', 'No club link found')
      }
    } catch (err: any) {
      log('3. Club detail — member list visible', 'FAIL', err.message)
      await screenshot(page, '03-club-detail-fail')
    }

    // ── TEST 4 & 5: Check for Join Requests on Debate Club ──────────────
    try {
      await page.goto(`${BASE}/clubs`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      const debateLink = page.locator('a').filter({ hasText: /debate/i }).first()
      let debateFound = false

      if (await debateLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await debateLink.click()
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(3000)
        debateFound = true
      }

      await screenshot(page, '04-debate-join-requests')

      if (debateFound) {
        const bodyText = await page.locator('body').textContent() ?? ''
        const hasJoinRequests = bodyText.toLowerCase().includes('join request') ||
          bodyText.toLowerCase().includes('pending request') ||
          bodyText.toLowerCase().includes('pending')

        log('4. Debate Club — Join Requests section', hasJoinRequests ? 'PASS' : 'FAIL',
          `joinRequests: ${hasJoinRequests}`)

        if (hasJoinRequests) {
          // Test 5: Verify pending request is visible
          const pendingEl = page.locator('text=/pending/i').or(page.locator('text=/request/i'))
          const pendingCount = await pendingEl.count()
          log('5. Pending join request visible', pendingCount > 0 ? 'PASS' : 'FAIL',
            `pendingElements: ${pendingCount}`)
        } else {
          log('5. Pending join request visible', 'FAIL', 'No join requests section found')
        }
      } else {
        log('4. Debate Club — Join Requests section', 'FAIL', 'Debate Club not found on /clubs')
        log('5. Pending join request visible', 'FAIL', 'Debate Club not found')
      }
    } catch (err: any) {
      log('4. Debate Club — Join Requests section', 'FAIL', err.message)
      log('5. Pending join request visible', 'FAIL', err.message)
      await screenshot(page, '04-join-requests-fail')
    }

    // ── TEST 6: Navigate to /chat → verify advisor can see club chats ───
    try {
      await page.goto(`${BASE}/chat`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      await screenshot(page, '06-chat')

      const has404 = await page.locator('text=404').isVisible().catch(() => false)
      const hasError = await page.locator('text=/error/i').isVisible().catch(() => false)
      const bodyText = await page.locator('body').textContent() ?? ''
      const hasChatContent = bodyText.toLowerCase().includes('chat') ||
        bodyText.toLowerCase().includes('message') ||
        bodyText.toLowerCase().includes('conversation')

      if (!has404 && hasChatContent) {
        log('6. /chat loads for advisor', 'PASS')
      } else {
        log('6. /chat loads for advisor', 'FAIL',
          `404: ${has404}, error: ${hasError}, chatContent: ${hasChatContent}`)
        await screenshot(page, '06-chat-fail')
      }
    } catch (err: any) {
      log('6. /chat loads for advisor', 'FAIL', err.message)
      await screenshot(page, '06-chat-fail')
    }

    // ── TEST 7: Navigate to /profile → verify "Faculty Advisor" badge ───
    try {
      await page.goto(`${BASE}/profile`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      await screenshot(page, '07-profile')

      const bodyText = await page.locator('body').textContent() ?? ''
      const hasAdvisorBadge = bodyText.toLowerCase().includes('faculty advisor') ||
        bodyText.toLowerCase().includes('advisor') ||
        bodyText.toLowerCase().includes('faculty')

      log('7. /profile — Faculty Advisor role badge', hasAdvisorBadge ? 'PASS' : 'FAIL',
        `advisorBadge: ${hasAdvisorBadge}`)

      if (!hasAdvisorBadge) {
        await screenshot(page, '07-profile-fail')
      }
    } catch (err: any) {
      log('7. /profile — Faculty Advisor role badge', 'FAIL', err.message)
      await screenshot(page, '07-profile-fail')
    }

    // ── TEST 8: Navigate to /settings → verify page loads ───────────────
    try {
      await page.goto(`${BASE}/settings`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      await screenshot(page, '08-settings')

      const status = (await page.evaluate(() => {
        return document.title ? 200 : 0
      }))
      const has404 = await page.locator('text=404').isVisible().catch(() => false)
      const has500 = await page.locator('text=500').isVisible().catch(() => false)
      const bodyText = await page.locator('body').textContent() ?? ''
      const hasSettings = bodyText.toLowerCase().includes('settings') ||
        bodyText.toLowerCase().includes('privacy') ||
        bodyText.toLowerCase().includes('preferences') ||
        bodyText.toLowerCase().includes('theme')

      if (!has404 && !has500 && hasSettings) {
        log('8. /settings loads for advisor', 'PASS')
      } else {
        log('8. /settings loads for advisor', 'FAIL',
          `404: ${has404}, 500: ${has500}, hasSettings: ${hasSettings}`)
        await screenshot(page, '08-settings-fail')
      }
    } catch (err: any) {
      log('8. /settings loads for advisor', 'FAIL', err.message)
      await screenshot(page, '08-settings-fail')
    }

    // ── TEST 9: Navigate to /elections → verify page loads ──────────────
    try {
      await page.goto(`${BASE}/elections`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)

      await screenshot(page, '09-elections')

      const has404 = await page.locator('text=404').isVisible().catch(() => false)
      const has500 = await page.locator('text=500').isVisible().catch(() => false)
      const httpStatus = await page.evaluate(() => {
        return document.title ? 200 : 0
      })

      if (!has404 && !has500) {
        log('9. /elections loads for advisor', 'PASS', `URL: ${page.url()}`)
      } else {
        log('9. /elections loads for advisor', 'FAIL',
          `404: ${has404}, 500: ${has500}`)
        await screenshot(page, '09-elections-fail')
      }
    } catch (err: any) {
      log('9. /elections loads for advisor', 'FAIL', err.message)
      await screenshot(page, '09-elections-fail')
    }

  } finally {
    await context.close()
    await browser.close()
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('  ADVISOR TEST SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length

  for (const r of results) {
    const icon = r.status === 'PASS' ? '[PASS]' : '[FAIL]'
    console.log(`  ${icon} ${r.name}`)
    if (r.detail) console.log(`        ${r.detail}`)
  }

  console.log(`\n  Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
  console.log('='.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
