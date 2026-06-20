/**
 * E2E Navigation + Elections + Clubs test
 *
 * Signs in as student via Clerk sign-in token, then:
 *   1. Navigates every sidebar page and checks for errors
 *   2. Tests elections page
 *   3. Tests club browsing + detail
 *   4. Tests deep links
 *
 * Run:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-navigation.ts
 */

import { chromium, Page } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const CLERK_SECRET = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET) {
  console.error('Missing CLERK_SECRET_KEY in .env.local')
  process.exit(1)
}

const STUDENT_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const BASE = 'http://localhost:3000'
const SCREENSHOTS = path.resolve(__dirname, 'screenshots')

// ── Helpers ────────────────────────────────────────────────────────────────

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

function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true })
  return page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: true })
}

const results: { test: string; status: 'PASS' | 'FAIL'; detail?: string }[] = []

function log(test: string, pass: boolean, detail?: string) {
  const status = pass ? 'PASS' : 'FAIL'
  results.push({ test, status, detail })
  console.log(`[${status}] ${test}${detail ? ' — ' + detail : ''}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== ClubIt Navigation & Elections E2E Test ===\n')

  // 1. Get sign-in token
  console.log('Creating Clerk sign-in token...')
  const tokenRes = await clerkApi('/sign_in_tokens', 'POST', { user_id: STUDENT_ID })
  if (!tokenRes.token) {
    console.error('Failed to create sign-in token:', tokenRes)
    process.exit(1)
  }
  console.log('Sign-in token created.\n')

  // 2. Launch browser
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  // Track JS errors globally
  const jsErrors: string[] = []
  page.on('pageerror', (err) => {
    jsErrors.push(err.message)
  })

  // 3. Sign in — Clerk ticket flow with retry
  console.log('Signing in...')
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${tokenRes.token}`)

  // Wait for Clerk to process the ticket and redirect
  // It may go to /dashboard, /join, or stay on /sign-in briefly
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.waitForTimeout(3000)
    const currentUrl = page.url()
    console.log(`  Sign-in attempt ${attempt + 1}: ${currentUrl}`)
    if (currentUrl.includes('/dashboard') || currentUrl.includes('/join')) break
    // If still on sign-in or root, try navigating to dashboard directly
    if (attempt >= 1) {
      await page.goto(`${BASE}/dashboard`)
      await page.waitForLoadState('networkidle').catch(() => {})
    }
  }

  const url = page.url()
  const signedIn = !url.includes('/sign-in') && !url.includes('/sign-up')
  log('Sign-in', signedIn, `URL: ${url}`)

  if (url.includes('/join')) {
    console.log('Redirected to /join — entering invite code...')
    const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
    await input.first().fill('DYPX-STU-HTLM')
    await page.getByRole('button', { name: /join school/i }).click()
    await page.waitForTimeout(5000)
    console.log('Post-join URL:', page.url())
  }

  if (!signedIn) {
    console.error('FATAL: Could not sign in. Aborting.')
    await snap(page, 'nav-signin-failed')
    await browser.close()
    process.exit(1)
  }

  // ────────────────────────────────────────────────────────────────────────
  // NAVIGATION TEST — every sidebar page
  // ────────────────────────────────────────────────────────────────────────

  console.log('\n--- Navigation Test ---\n')

  const pages: { route: string; check: (p: Page) => Promise<boolean>; label: string }[] = [
    {
      route: '/dashboard',
      label: 'Dashboard — greeting text',
      check: async (p) => {
        const hi = await p.locator('text=Hi,').isVisible().catch(() => false)
        const noClubs = await p.locator("text=haven't joined").isVisible().catch(() => false)
        const myClubs = await p.locator('text=My Clubs').isVisible().catch(() => false)
        return hi || noClubs || myClubs
      },
    },
    {
      route: '/events',
      label: 'Events — page loads',
      check: async (p) => {
        const events = await p.locator('text=Events').first().isVisible().catch(() => false)
        const noEvents = await p.locator('text=No upcoming').isVisible().catch(() => false)
        const calendar = await p.locator('text=Calendar').isVisible().catch(() => false)
        return events || noEvents || calendar
      },
    },
    {
      route: '/chat',
      label: 'Chat — Club Chats heading',
      check: async (p) => {
        const chats = await p.locator('text=Club Chats').isVisible().catch(() => false)
        const chat = await p.locator('text=Chat').first().isVisible().catch(() => false)
        const noChat = await p.locator('text=No chats').isVisible().catch(() => false)
        return chats || chat || noChat
      },
    },
    {
      route: '/elections',
      label: 'Elections — page loads',
      check: async (p) => {
        const elections = await p.locator('text=Elections').first().isVisible().catch(() => false)
        const noElections = await p.locator('text=No elections').isVisible().catch(() => false)
        const forms = await p.locator('text=Form').first().isVisible().catch(() => false)
        return elections || noElections || forms
      },
    },
    {
      route: '/clubs',
      label: 'Clubs — All Clubs or grid',
      check: async (p) => {
        const allClubs = await p.locator('text=All Clubs').isVisible().catch(() => false)
        const explore = await p.locator('text=Explore').first().isVisible().catch(() => false)
        const clubs = await p.locator('text=Clubs').first().isVisible().catch(() => false)
        return allClubs || explore || clubs
      },
    },
    {
      route: '/profile',
      label: 'Profile — hero section',
      check: async (p) => {
        const profile = await p.locator('text=Profile').first().isVisible().catch(() => false)
        const avatar = await p.locator('img').first().isVisible().catch(() => false)
        return profile || avatar
      },
    },
    {
      route: '/settings',
      label: 'Settings — heading',
      check: async (p) => {
        const settings = await p.locator('text=Settings').first().isVisible().catch(() => false)
        const privacy = await p.locator('text=Privacy').first().isVisible().catch(() => false)
        return settings || privacy
      },
    },
  ]

  for (const { route, check, label } of pages) {
    // Clear JS errors for this page
    const errorsBefore = jsErrors.length

    const res = await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const status = res?.status() ?? 0
    const hasError = await page.locator('text=Internal Server Error').isVisible().catch(() => false)
    const newJsErrors = jsErrors.slice(errorsBefore)

    const checkPassed = await check(page)

    const pass = status < 500 && !hasError && checkPassed
    let detail = `HTTP ${status}`
    if (newJsErrors.length > 0) detail += ` | JS errors: ${newJsErrors.length}`
    if (hasError) detail += ' | Internal Server Error'
    if (!checkPassed) detail += ' | content check failed'

    log(label, pass, detail)
    await snap(page, `nav${route.replace(/\//g, '-')}`)
  }

  // ────────────────────────────────────────────────────────────────────────
  // ELECTIONS PAGE
  // ────────────────────────────────────────────────────────────────────────

  console.log('\n--- Elections Page Test ---\n')

  await page.goto(`${BASE}/elections`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const electionsContent = await page.textContent('body').catch(() => '')
  const hasElectionsList = await page.locator('[class*="card"], [class*="Card"]').count() > 0
  const hasEmptyState = electionsContent?.toLowerCase().includes('no election') ||
                        electionsContent?.toLowerCase().includes('no active') ||
                        electionsContent?.toLowerCase().includes('empty')

  log('Elections — content visible', hasElectionsList || (hasEmptyState ?? false),
    hasElectionsList ? `Found ${await page.locator('[class*="card"], [class*="Card"]').count()} cards` : 'Empty state')

  await snap(page, 'elections-page')

  // ────────────────────────────────────────────────────────────────────────
  // CLUBS BROWSING
  // ────────────────────────────────────────────────────────────────────────

  console.log('\n--- Clubs Browsing Test ---\n')

  await page.goto(`${BASE}/clubs`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  // Check for club cards
  const clubCards = page.locator('a[href*="/clubs/"]')
  const cardCount = await clubCards.count()
  log('Clubs — cards displayed', cardCount > 0, `Found ${cardCount} club links`)
  await snap(page, 'clubs-browse')

  // Try to click on Chess Club (or first available club)
  let clubClicked = false
  const chessClub = page.locator('a[href*="/clubs/"]').filter({ hasText: /chess/i })
  if (await chessClub.count() > 0) {
    await chessClub.first().click()
    clubClicked = true
    console.log('Clicked Chess Club')
  } else if (cardCount > 0) {
    await clubCards.first().click()
    clubClicked = true
    console.log('Clicked first available club')
  }

  if (clubClicked) {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const clubUrl = page.url()
    const clubName = await page.locator('h1').first().textContent().catch(() => '')
    const clubDesc = await page.locator('p').first().textContent().catch(() => '')

    log('Club detail — page loads', clubUrl.includes('/clubs/'), `URL: ${clubUrl}`)
    log('Club detail — name visible', (clubName?.length ?? 0) > 0, `Name: "${clubName?.trim()}"`)
    log('Club detail — description visible', (clubDesc?.length ?? 0) > 0,
      `Desc: "${clubDesc?.trim().substring(0, 60)}..."`)

    await snap(page, 'club-detail')

    // Navigate back
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    log('Clubs — back navigation', page.url().includes('/clubs'), `URL: ${page.url()}`)
  } else {
    log('Club detail — skipped', false, 'No club cards to click')
  }

  // ────────────────────────────────────────────────────────────────────────
  // DEEP LINK TESTS
  // ────────────────────────────────────────────────────────────────────────

  console.log('\n--- Deep Link Tests ---\n')

  // Deep link to chat
  await page.goto(`${BASE}/chat/test-club-1776121463`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const chatUrl = page.url()
  const chatStatus = chatUrl.includes('/chat')
  // Check for actual 404 page headings, not substrings in content
  const chatHas404 = await page.locator('h1:has-text("404"), h2:has-text("Not Found")').isVisible().catch(() => false)
  const chatHasContent = await page.locator('text=Chess Club').or(page.locator('text=Message')).first().isVisible().catch(() => false)
  log('Deep link — /chat/test-club-1776121463', chatStatus && !chatHas404 && chatHasContent,
    `URL: ${chatUrl}${chatHas404 ? ' (404 page)' : ''}${chatHasContent ? ' | chat loaded' : ''}`)
  await snap(page, 'deep-link-chat')

  // Deep link to club
  await page.goto(`${BASE}/clubs/test-club-1776121463`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const clubDeepUrl = page.url()
  const clubDeepStatus = clubDeepUrl.includes('/clubs')
  const clubHas404 = await page.locator('h1:has-text("404"), h2:has-text("Not Found")').isVisible().catch(() => false)
  const clubHasContent = await page.locator('text=Chess Club').isVisible().catch(() => false)
  log('Deep link — /clubs/test-club-1776121463', clubDeepStatus && !clubHas404 && clubHasContent,
    `URL: ${clubDeepUrl}${clubHas404 ? ' (404 page)' : ''}${clubHasContent ? ' | club loaded' : ''}`)
  await snap(page, 'deep-link-club')

  // ────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60))
  console.log('  RESULTS SUMMARY')
  console.log('='.repeat(60))

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const total = results.length

  for (const r of results) {
    console.log(`  [${r.status}] ${r.test}${r.detail ? ' — ' + r.detail : ''}`)
  }

  console.log('='.repeat(60))
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
  console.log('='.repeat(60))

  if (jsErrors.length > 0) {
    console.log(`\n  JS Console Errors (${jsErrors.length}):`)
    for (const err of jsErrors.slice(0, 10)) {
      console.log(`    - ${err.substring(0, 120)}`)
    }
  }

  console.log('\nScreenshots saved to tests/e2e/screenshots/')

  await browser.close()

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
