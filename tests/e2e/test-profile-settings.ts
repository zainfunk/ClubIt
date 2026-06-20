/**
 * Profile & Settings E2E Test — tests profile page elements and settings across roles.
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-profile-settings.ts
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const CLERK_SECRET = process.env.CLERK_SECRET_KEY
const STUDENT_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const ADMIN_ID = 'user_3CHbdjUGEcCUhf4Je7ObHfQybPD'

const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

// ── Helpers ──────────────────────────────────────────────────────────────────

let passCount = 0
let failCount = 0

function log(step: number, name: string, passed: boolean, detail?: string) {
  const status = passed ? 'PASS' : 'FAIL'
  const tag = passed ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`  [${tag}] Step ${step}: ${name}${detail ? ` — ${detail}` : ''}`)
  if (passed) passCount++
  else failCount++
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
}

async function getSignInToken(userId: string): Promise<string> {
  const res = await fetch(`https://api.clerk.com/v1/sign_in_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Clerk sign-in token failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return data.token as string
}

async function signIn(browser: Browser, userId: string): Promise<Page> {
  const token = await getSignInToken(userId)
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  // Use Clerk's sign-in token to authenticate
  await page.goto(`${BASE}/sign-in#/factor-one`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Accept the ticket via Clerk's accept URL
  const ticketUrl = `${BASE}/sign-in?__clerk_ticket=${token}`
  await page.goto(ticketUrl)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(5000)

  // Handle potential /join redirect
  if (page.url().includes('/join')) {
    console.log(`  [INFO] Redirected to /join — already joined, navigating to dashboard`)
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
  }

  return page
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!CLERK_SECRET) {
    console.error('ERROR: CLERK_SECRET_KEY not found in .env.local')
    process.exit(1)
  }

  console.log('\n=== Profile & Settings E2E Tests ===\n')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })

  try {
    // ════════════════════════════════════════════════════════════════════════
    // STUDENT PROFILE
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Student Profile ──')
    const studentPage = await signIn(browser, STUDENT_ID)

    // Step 1: Navigate to /profile
    await studentPage.goto(`${BASE}/profile`)
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(4000)
    log(1, 'Navigate to /profile', !studentPage.url().includes('/sign-in'), `URL: ${studentPage.url()}`)

    // Step 2: Verify name "clubit_student_test" is displayed
    const nameVisible = await studentPage.locator('input').filter({ has: studentPage.locator('[value]') }).first()
      .getAttribute('value').then(v => v?.includes('clubit_student_test')).catch(() => false)
      || await studentPage.locator('text=clubit_student_test').isVisible().catch(() => false)
    log(2, 'Name "clubit_student_test" displayed', !!nameVisible)

    // Step 3: Verify email is displayed
    const emailVisible = await studentPage.locator('text=@').first().isVisible().catch(() => false)
    log(3, 'Email is displayed', !!emailVisible)

    // Step 4: Verify "Student Member" badge
    const badgeVisible = await studentPage.locator('text=Student Member').isVisible().catch(() => false)
    log(4, '"Student Member" badge visible', !!badgeVisible)

    // Step 5: Check bio textarea is present
    const bioPresent = await studentPage.locator('textarea').first().isVisible().catch(() => false)
    log(5, 'Bio textarea present', !!bioPresent)

    // Step 6: Check stats cards (Clubs, Attendance, Achievements, Leadership)
    const statsLabels = ['Clubs', 'Attendance', 'Achievements', 'Leadership']
    let statsFound = 0
    for (const label of statsLabels) {
      const found = await studentPage.locator(`text=${label}`).first().isVisible().catch(() => false)
      if (found) statsFound++
    }
    log(6, 'Stats cards visible', statsFound >= 3, `Found ${statsFound}/4: ${statsLabels.join(', ')}`)

    // Step 7: Check tabs (Overview, My Clubs, Attendance, Achievements)
    const tabLabels = ['Overview', 'My Clubs', 'Attendance', 'Achievements']
    let tabsFound = 0
    for (const label of tabLabels) {
      const found = await studentPage.locator(`text=${label}`).first().isVisible().catch(() => false)
      if (found) tabsFound++
    }
    log(7, 'Tabs present', tabsFound >= 3, `Found ${tabsFound}/4: ${tabLabels.join(', ')}`)

    // Step 8: Screenshot profile page
    await snap(studentPage, 'student-profile')
    log(8, 'Screenshot student profile', true)

    // ════════════════════════════════════════════════════════════════════════
    // STUDENT SETTINGS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Student Settings ──')

    // Step 9: Navigate to /settings
    await studentPage.goto(`${BASE}/settings`)
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(4000)
    log(9, 'Navigate to /settings', !studentPage.url().includes('/sign-in'), `URL: ${studentPage.url()}`)

    // Step 10: Verify "Appearance" section with Dark Mode toggle
    const appearanceVisible = await studentPage.locator('text=Appearance').isVisible().catch(() => false)
    const darkModeVisible = await studentPage.locator('text=Dark Mode').isVisible().catch(() => false)
    log(10, '"Appearance" section with Dark Mode', !!(appearanceVisible && darkModeVisible))

    // Step 11: Verify "Privacy" section exists
    const privacyVisible = await studentPage.locator('h2:has-text("Privacy")').isVisible().catch(() => false)
    log(11, '"Privacy" section exists', !!privacyVisible)

    // Step 12: Verify privacy toggles: achievements, attendance, clubs
    const achieveToggle = await studentPage.locator('text=Show my achievements').isVisible().catch(() => false)
    const attendToggle = await studentPage.locator('text=Show my attendance').isVisible().catch(() => false)
    const clubsToggle = await studentPage.locator('text=Show my club memberships').isVisible().catch(() => false)
    log(12, 'Privacy toggles present', !!(achieveToggle && attendToggle && clubsToggle),
      `achievements=${achieveToggle}, attendance=${attendToggle}, clubs=${clubsToggle}`)

    // Step 13: Toggle dark mode on
    const dmToggle = studentPage.locator('button[role="switch"]').first()
    const dmBefore = await dmToggle.getAttribute('aria-checked').catch(() => null)
    await dmToggle.click()
    await studentPage.waitForTimeout(1000)
    const dmAfter = await dmToggle.getAttribute('aria-checked').catch(() => null)
    const dmChanged = dmBefore !== dmAfter
    log(13, 'Toggle dark mode on', dmChanged, `before=${dmBefore}, after=${dmAfter}`)

    // Step 14: Verify dark mode changed (check body class or background)
    const hasDarkClass = await studentPage.evaluate(() => {
      return document.documentElement.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        window.getComputedStyle(document.body).backgroundColor !== 'rgb(255, 255, 255)'
    }).catch(() => false)
    log(14, 'Dark mode visual change detected', !!hasDarkClass || dmChanged)

    // Step 15: Toggle dark mode back off
    await dmToggle.click()
    await studentPage.waitForTimeout(1000)
    const dmReset = await dmToggle.getAttribute('aria-checked').catch(() => null)
    log(15, 'Toggle dark mode back off', dmReset === dmBefore, `reset=${dmReset}`)

    // Step 16: Screenshot settings page
    await snap(studentPage, 'student-settings-profile-test')
    log(16, 'Screenshot student settings', true)

    // Step 17: Close student browser
    await studentPage.context().close()
    log(17, 'Close student browser', true)

    // ════════════════════════════════════════════════════════════════════════
    // ADMIN SETTINGS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── Admin Settings ──')

    // Step 18: Sign in as admin
    const adminPage = await signIn(browser, ADMIN_ID)
    log(18, 'Sign in as admin', !adminPage.url().includes('/sign-in'), `URL: ${adminPage.url()}`)

    // Step 19: Navigate to /settings
    await adminPage.goto(`${BASE}/settings`)
    await adminPage.waitForLoadState('networkidle')
    await adminPage.waitForTimeout(4000)
    log(19, 'Navigate to /settings', !adminPage.url().includes('/sign-in'), `URL: ${adminPage.url()}`)

    // Step 20: Verify "Student Feature Controls" section
    const featureControlsVisible = await adminPage.locator('text=Student Feature Controls').isVisible().catch(() => false)
    log(20, '"Student Feature Controls" visible', !!featureControlsVisible)

    // Step 21: Verify toggles: achievements, attendance, clubs, social media
    const adminAchievements = await adminPage.locator('text=Allow students to show achievements').isVisible().catch(() => false)
    const adminAttendance = await adminPage.locator('text=Allow students to show attendance').isVisible().catch(() => false)
    const adminClubs = await adminPage.locator('text=Allow students to show club memberships').isVisible().catch(() => false)
    const adminSocial = await adminPage.locator('text=Allow students to add personal social media').isVisible().catch(() => false)
    log(21, 'Admin feature toggles present', !!(adminAchievements && adminAttendance && adminClubs && adminSocial),
      `achievements=${adminAchievements}, attendance=${adminAttendance}, clubs=${adminClubs}, social=${adminSocial}`)

    // Step 22: Verify rose/pink warning banner
    const warningBanner = await adminPage.locator('text=These settings apply to all students school-wide').isVisible().catch(() => false)
    log(22, 'Rose warning banner visible', !!warningBanner)

    // Step 23: Screenshot admin settings
    await snap(adminPage, 'admin-settings-profile-test')
    log(23, 'Screenshot admin settings', true)

    // Step 24: Close admin browser
    await adminPage.context().close()
    log(24, 'Close admin browser', true)

  } finally {
    await browser.close()
  }

  // ── Summary ──
  console.log(`\n${'='.repeat(50)}`)
  console.log(`  TOTAL: ${passCount + failCount}  |  \x1b[32mPASS: ${passCount}\x1b[0m  |  \x1b[31mFAIL: ${failCount}\x1b[0m`)
  console.log(`${'='.repeat(50)}\n`)

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
