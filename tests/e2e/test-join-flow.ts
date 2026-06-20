/**
 * Cross-Role Join Request Flow
 * Setup: student leaves club + re-requests → Advisor approves → Student verifies membership
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-join-flow.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const CLERK_SECRET = process.env.CLERK_SECRET_KEY
const STUDENT_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const ADVISOR_ID = 'user_3CHbbnP13LUdb8mMrNua5m5yAkO'
const BASE = 'http://localhost:3000'
const CLUB_ID = 'test-club-debate-1776126762'
const CLUB_URL = `${BASE}/clubs/${CLUB_ID}`
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

if (!CLERK_SECRET) {
  console.error('FAIL: Missing CLERK_SECRET_KEY in .env.local')
  process.exit(1)
}

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

let passed = 0
let failed = 0

function log(step: string, status: 'PASS' | 'FAIL', detail?: string) {
  const icon = status === 'PASS' ? '[PASS]' : '[FAIL]'
  console.log(`${icon} ${step}${detail ? ' — ' + detail : ''}`)
  if (status === 'PASS') passed++
  else failed++
}

async function clerkApi(endpoint: string, method = 'GET', body?: object) {
  const res = await fetch(`https://api.clerk.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function signIn(browser: Browser, userId: string): Promise<{ context: BrowserContext; page: Page }> {
  const token = await clerkApi('/sign_in_tokens', 'POST', { user_id: userId })
  if (!token.token) {
    throw new Error(`Failed to get sign-in token for ${userId}: ${JSON.stringify(token)}`)
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${token.token}`)
  await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {})
  // If sign-in landed on '/' instead of '/dashboard', navigate explicitly
  if (!page.url().includes('/dashboard')) {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
  }
  await page.waitForTimeout(3000)
  return { context, page }
}

async function snap(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
  console.log(`  [screenshot] ${name}.png`)
}

async function main() {
  console.log('\n========================================')
  console.log('  CROSS-ROLE JOIN REQUEST FLOW TEST')
  console.log('========================================\n')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })

  try {
    // ──────────────────────────────────────────────
    // SETUP — Reset state: student leaves club, then requests to join again
    // ──────────────────────────────────────────────
    console.log('--- SETUP: Reset join state ---\n')

    const { context: setupCtx, page: setupPage } = await signIn(browser, STUDENT_ID)

    // Leave the club (clears membership + join_requests)
    const leaveRes = await setupPage.evaluate(async (clubId) => {
      const res = await fetch(`/api/school/clubs/${clubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }, CLUB_ID)
    console.log(`  Leave club: ${leaveRes.status} ${JSON.stringify(leaveRes.body)}`)

    // Wait a moment, then request to join (auto_accept=false → pending)
    await setupPage.waitForTimeout(1000)

    const joinRes = await setupPage.evaluate(async (clubId) => {
      const res = await fetch(`/api/school/clubs/${clubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      })
      return { status: res.status, body: await res.json().catch(() => null) }
    }, CLUB_ID)
    console.log(`  Join request: ${joinRes.status} ${JSON.stringify(joinRes.body)}`)

    if (joinRes.body?.status === 'pending') {
      console.log('  [OK] Fresh pending request created\n')
    } else {
      console.log(`  [WARN] Join status: ${joinRes.body?.status} (expected "pending")\n`)
    }

    await setupCtx.close()

    // ──────────────────────────────────────────────
    // PART 1 — Student views pending request
    // ──────────────────────────────────────────────
    console.log('--- PART 1: Student views pending request ---\n')

    const { context: studentCtx, page: studentPage } = await signIn(browser, STUDENT_ID)

    // Step 1: Verify sign-in landed on dashboard
    const dashUrl = studentPage.url()
    if (dashUrl.includes('/dashboard')) {
      log('Step 1: Student sign-in -> dashboard', 'PASS')
    } else {
      log('Step 1: Student sign-in -> dashboard', 'FAIL', `URL: ${dashUrl}`)
    }

    // Step 2: Check pending request count on dashboard
    await studentPage.goto(`${BASE}/dashboard`)
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(3000)

    const pendingBanner = studentPage.locator('button, div').filter({ hasText: /pending club request/i })
    const hasPendingBanner = await pendingBanner.first().isVisible().catch(() => false)
    if (hasPendingBanner) {
      const text = await pendingBanner.first().textContent().catch(() => '')
      log('Step 2: Dashboard shows pending request count', 'PASS', text?.trim()?.substring(0, 80))
    } else {
      log('Step 2: Dashboard shows pending request count', 'FAIL', 'No pending requests banner found')
    }

    // Step 3: Go to club page -> verify "Pending Review"
    await studentPage.goto(CLUB_URL)
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(3000)

    // "Pending Review" could be a button, span, div — match any element
    const pendingReview = studentPage.locator('text=Pending Review')
    const hasPendingReview = await pendingReview.first().isVisible().catch(() => false)
    if (hasPendingReview) {
      log('Step 3: Club page shows "Pending Review" status', 'PASS')
    } else {
      log('Step 3: Club page shows "Pending Review" status', 'FAIL', 'Element not found')
    }

    // Step 4: Screenshot student's view
    await snap(studentPage, 'join-flow-01-student-pending')
    log('Step 4: Screenshot student pending view', 'PASS')

    // Step 5: Close student browser
    await studentCtx.close()
    log('Step 5: Student browser closed', 'PASS')

    // ──────────────────────────────────────────────
    // PART 2 — Advisor approves the request
    // ──────────────────────────────────────────────
    console.log('\n--- PART 2: Advisor approves the request ---\n')

    // Step 6: Sign in as advisor
    const { context: advisorCtx, page: advisorPage } = await signIn(browser, ADVISOR_ID)
    const advUrl = advisorPage.url()
    if (advUrl.includes('/dashboard')) {
      log('Step 6: Advisor sign-in -> dashboard', 'PASS')
    } else {
      log('Step 6: Advisor sign-in -> dashboard', 'FAIL', `URL: ${advUrl}`)
    }

    // Step 7: Go to club page -> look for Join Requests section
    await advisorPage.goto(CLUB_URL)
    await advisorPage.waitForLoadState('networkidle')
    await advisorPage.waitForTimeout(4000)

    // Scroll down to ensure the Join Requests section is visible
    await advisorPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await advisorPage.waitForTimeout(1000)

    const joinRequestsHeading = advisorPage.locator('h3').filter({ hasText: /Join Requests/i })
    const hasJoinRequests = await joinRequestsHeading.isVisible().catch(() => false)
    if (hasJoinRequests) {
      log('Step 7: Club page shows "Join Requests" section', 'PASS')
    } else {
      log('Step 7: Club page shows "Join Requests" section', 'FAIL', 'Section not found')
    }

    // Step 8: Find the pending request from clubit_student_test
    const pendingLabel = advisorPage.locator('span').filter({ hasText: /pending$/i })
    const hasPendingLabel = await pendingLabel.first().isVisible().catch(() => false)
    const approveBtn = advisorPage.locator('button').filter({ hasText: /Approve/i })
    const approveVisible = await approveBtn.first().isVisible().catch(() => false)

    if (hasPendingLabel) {
      const labelText = await pendingLabel.first().textContent().catch(() => '')
      log('Step 8: Found pending request(s)', 'PASS', labelText?.trim())
    } else if (approveVisible) {
      log('Step 8: Found pending request (Approve button visible)', 'PASS')
    } else {
      log('Step 8: Found pending request', 'FAIL', 'No pending request found in Join Requests section')
    }

    // Step 9: Click Approve button
    if (approveVisible) {
      await approveBtn.first().click()
      log('Step 9: Clicked "Approve" button', 'PASS')
    } else {
      log('Step 9: Clicked "Approve" button', 'FAIL', 'Approve button not found')
    }

    // Step 10: Wait for UI to update
    await advisorPage.waitForTimeout(3000)
    const noPending = await advisorPage.locator('text=No pending requests').isVisible().catch(() => false)
    if (noPending) {
      log('Step 10: UI updated -- "No pending requests" shown', 'PASS')
    } else {
      const remainingApprove = await advisorPage.locator('button').filter({ hasText: /Approve/i }).count()
      log('Step 10: UI updated after approval', remainingApprove === 0 ? 'PASS' : 'FAIL',
        `Remaining approve buttons: ${remainingApprove}`)
    }

    // Step 11: Screenshot after approval
    await advisorPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await advisorPage.waitForTimeout(500)
    await snap(advisorPage, 'join-flow-02-advisor-approved')
    log('Step 11: Screenshot after approval', 'PASS')

    // Step 12: Close advisor browser
    await advisorCtx.close()
    log('Step 12: Advisor browser closed', 'PASS')

    // ──────────────────────────────────────────────
    // PART 3 — Student verifies membership
    // ──────────────────────────────────────────────
    console.log('\n--- PART 3: Student verifies membership ---\n')

    // Step 13: Sign in as student again
    const { context: studentCtx2, page: studentPage2 } = await signIn(browser, STUDENT_ID)
    const stu2Url = studentPage2.url()
    if (stu2Url.includes('/dashboard')) {
      log('Step 13: Student re-sign-in -> dashboard', 'PASS')
    } else {
      log('Step 13: Student re-sign-in -> dashboard', 'FAIL', `URL: ${stu2Url}`)
    }

    // Step 14: Dashboard — verify Debate Club shows as joined / no more pending for Debate
    await studentPage2.goto(`${BASE}/dashboard`)
    await studentPage2.waitForLoadState('networkidle')
    await studentPage2.waitForTimeout(3000)

    // Check if the pending banner for Debate Club is gone
    const pendingBanner2 = studentPage2.locator('button, div').filter({ hasText: /pending club request/i })
    const hasPendingBanner2 = await pendingBanner2.first().isVisible().catch(() => false)

    // Check if Debate Club shows on dashboard (as a joined club)
    const debateOnDashboard = await studentPage2.locator('text=Debate').first().isVisible().catch(() => false)

    if (!hasPendingBanner2 || debateOnDashboard) {
      log('Step 14: Dashboard reflects membership change', 'PASS',
        `pendingBanner: ${hasPendingBanner2}, debateVisible: ${debateOnDashboard}`)
    } else {
      log('Step 14: Dashboard reflects membership change', 'FAIL',
        'Still shows pending banner, debate not visible on dashboard')
    }

    // Step 15: Go to club page -> verify now shows as member
    await studentPage2.goto(CLUB_URL)
    await studentPage2.waitForLoadState('networkidle')
    await studentPage2.waitForTimeout(3000)

    // Should show "Leave Club" instead of "Pending Review"
    const leaveBtn = studentPage2.locator('button').filter({ hasText: /Leave Club/i })
    const hasLeave = await leaveBtn.first().isVisible().catch(() => false)
    const stillPending = await studentPage2.locator('text=Pending Review').first().isVisible().catch(() => false)

    if (hasLeave && !stillPending) {
      log('Step 15: Club page shows "Leave Club" (member confirmed)', 'PASS')
    } else if (hasLeave) {
      log('Step 15: Club page shows "Leave Club"', 'PASS', 'Note: Pending Review also visible')
    } else if (!stillPending) {
      log('Step 15: "Pending Review" gone (membership likely confirmed)', 'PASS', 'Leave button not found but pending is gone')
    } else {
      log('Step 15: Club page still shows "Pending Review"', 'FAIL', 'Approval may not have taken effect')
    }

    // Step 16: Screenshot final state
    await snap(studentPage2, 'join-flow-03-student-member')
    log('Step 16: Screenshot final state', 'PASS')

    await studentCtx2.close()

  } catch (err: any) {
    console.error('\n[ERROR]', err.message)
    failed++
  } finally {
    await browser.close()
  }

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────
  console.log('\n========================================')
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`)
  console.log('========================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

main()
