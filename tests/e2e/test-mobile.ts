/**
 * Mobile UI E2E Test — iPhone 14 viewport (390x844)
 *
 * Tests bottom tab bar, sidebar hidden, TopBar, navigation, profile layout,
 * overflow, and screenshots across all major pages.
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-mobile.ts
 */

import { chromium, Page, BrowserContext } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const CLERK_SECRET = process.env.CLERK_SECRET_KEY!
const STUDENT_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const BASE = 'http://localhost:3000'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function log(label: string, ok: boolean, detail?: string) {
  const status = ok ? 'PASS' : 'FAIL'
  console.log(`[${status}] ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) passed++
  else failed++
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const p = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`       screenshot: ${name}.png`)
}

async function clerkSignInToken(userId: string): Promise<string> {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })
  const data = await res.json()
  if (!data.token) throw new Error('Failed to get Clerk sign-in token: ' + JSON.stringify(data))
  return data.token
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== ClubIt Mobile UI E2E Test (iPhone 14: 390x844) ===\n')

  // 1. Sign in
  const token = await clerkSignInToken(STUDENT_ID)
  console.log('[INFO] Clerk sign-in token acquired\n')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()

  // ── Test 1: Sign in and navigate to dashboard ──────────────────────────
  // Navigate to sign-in with Clerk ticket; wait for redirect chain to finish
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${token}`, { waitUntil: 'domcontentloaded' })
  // Wait for Clerk to process the ticket and redirect
  await page.waitForTimeout(5000)

  // If we're still on sign-in, try waiting for dashboard URL
  if (!page.url().includes('/dashboard')) {
    console.log('[INFO] Still on:', page.url(), '— waiting longer...')
    await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(3000)
  }

  // If still not on dashboard, try navigating directly (session might be set)
  if (!page.url().includes('/dashboard')) {
    console.log('[INFO] Trying direct navigation to /dashboard...')
    await page.goto(`${BASE}/dashboard`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
  }

  const onDashboard = page.url().includes('/dashboard')
  log('1. Sign in → dashboard', onDashboard, `URL: ${page.url()}`)

  // ── Test 2: Bottom tab bar visible (5 tabs) ───────────────────────────
  const tabBar = page.locator('nav.fixed.bottom-0')
  const tabBarVisible = await tabBar.isVisible().catch(() => false)
  const tabLinks = tabBar.locator('a')
  const tabCount = await tabLinks.count()
  log('2. Bottom tab bar visible (5 tabs)', tabBarVisible && tabCount === 5, `visible=${tabBarVisible}, tabs=${tabCount}`)

  // ── Test 3: Sidebar NOT visible ────────────────────────────────────────
  // The desktop sidebar has class "hidden md:flex" — so it should have display:none on mobile
  const sidebar = page.locator('aside, nav.hidden.md\\:flex, nav.fixed.left-0.top-0.h-screen').first()
  const sidebarBox = await sidebar.boundingBox().catch(() => null)
  const sidebarHidden = sidebarBox === null || sidebarBox.width === 0
  log('3. Sidebar hidden on mobile', sidebarHidden, sidebarBox ? `width=${sidebarBox.width}` : 'not rendered')

  // ── Test 4: TopBar visible with title ──────────────────────────────────
  const topBar = page.locator('header').first()
  const topBarVisible = await topBar.isVisible().catch(() => false)
  log('4. TopBar visible', topBarVisible)

  // ── Test 5: Screenshot dashboard ───────────────────────────────────────
  await snap(page, 'mobile-01-dashboard')
  log('5. Dashboard screenshot', true)

  // ── Test 6: Click "Chat" tab → /chat ──────────────────────────────────
  await tabBar.locator('a', { hasText: 'Chat' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const onChat = page.url().includes('/chat')
  log('6. Chat tab → /chat', onChat, `URL: ${page.url()}`)

  // ── Test 7: Screenshot chat ────────────────────────────────────────────
  await snap(page, 'mobile-02-chat')
  log('7. Chat screenshot', true)

  // ── Test 8: Click "Clubs" tab → /clubs ─────────────────────────────────
  await tabBar.locator('a[href="/clubs"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const onClubs = page.url().includes('/clubs')
  log('8. Clubs tab → /clubs', onClubs, `URL: ${page.url()}`)

  // ── Test 9: Screenshot clubs ───────────────────────────────────────────
  await snap(page, 'mobile-03-clubs')
  log('9. Clubs screenshot', true)

  // ── Test 10: Click "Profile" tab → /profile ────────────────────────────
  await tabBar.locator('a', { hasText: 'Profile' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const onProfile = page.url().includes('/profile')
  log('10. Profile tab → /profile', onProfile, `URL: ${page.url()}`)

  // ── Test 11: Profile hero stacks vertically (avatar above name) ────────
  // The profile hero uses "flex flex-col sm:flex-row" — on mobile (390px) it should be flex-col.
  // Avatar is inside a .rounded-2xl wrapper, name is in the next sibling div.
  const heroContainer = page.locator('.flex.flex-col.items-center').first()
  const avatarWrapper = heroContainer.locator('.rounded-2xl').first()
  const nameEl = heroContainer.locator('div.min-w-0').first()
  const avatarBox = await avatarWrapper.boundingBox().catch(() => null)
  const nameBox = await nameEl.boundingBox().catch(() => null)
  let verticalStack = false
  if (avatarBox && nameBox) {
    // Avatar bottom should be above or near name top (stacked, not side-by-side)
    verticalStack = avatarBox.y + avatarBox.height <= nameBox.y + 20
  }
  log('11. Profile hero stacks vertically', verticalStack,
    avatarBox && nameBox
      ? `avatar.bottom=${Math.round(avatarBox.y + avatarBox.height)} name.top=${Math.round(nameBox.y)}`
      : 'elements not found')

  // ── Test 12: Screenshot profile ────────────────────────────────────────
  await snap(page, 'mobile-04-profile')
  log('12. Profile screenshot', true)

  // ── Test 13: Click "More" tab → /settings ──────────────────────────────
  await tabBar.locator('a', { hasText: 'More' }).click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  const onSettings = page.url().includes('/settings')
  log('13. More tab → /settings', onSettings, `URL: ${page.url()}`)

  // ── Test 14: Screenshot settings ───────────────────────────────────────
  await snap(page, 'mobile-05-settings')
  log('14. Settings screenshot', true)

  // ── Test 15: Club chat page works without sidebar ──────────────────────
  await page.goto(`${BASE}/chat/test-club-1776121463`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const chatDetailUrl = page.url()
  const chatDetailLoaded = !chatDetailUrl.includes('/404') && !chatDetailUrl.includes('/sign-in')
  // Sidebar should still be hidden
  const sidebarInChat = await page.locator('nav.fixed.left-0.top-0.h-screen').first().boundingBox().catch(() => null)
  const sidebarStillHidden = sidebarInChat === null || sidebarInChat.width === 0
  log('15. Club chat works on mobile (no sidebar)', chatDetailLoaded && sidebarStillHidden,
    `URL: ${chatDetailUrl}, sidebarHidden=${sidebarStillHidden}`)

  // ── Test 16: Screenshot chat detail ────────────────────────────────────
  await snap(page, 'mobile-06-chat-detail')
  log('16. Chat detail screenshot', true)

  // ── Test 17: No horizontal overflow ────────────────────────────────────
  // Check that document.documentElement.scrollWidth does not exceed viewport width (390)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const noOverflow = scrollWidth <= 390
  log('17. No horizontal overflow', noOverflow, `scrollWidth=${scrollWidth}, viewport=390`)

  // Also check on other pages we visited
  const overflowPages: string[] = []
  for (const route of ['/dashboard', '/chat', '/clubs', '/profile', '/settings']) {
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    if (sw > 390) overflowPages.push(`${route}(${sw}px)`)
  }
  if (overflowPages.length > 0) {
    log('17b. Overflow check all pages', false, `overflow on: ${overflowPages.join(', ')}`)
  } else {
    log('17b. Overflow check all pages', true, 'all pages <= 390px')
  }

  // ── Summary ────────────────────────────────────────────────────────────
  await browser.close()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  MOBILE UI TEST RESULTS`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total:  ${passed + failed}`)
  console.log(`${'='.repeat(50)}\n`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
