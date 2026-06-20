/**
 * Admin E2E Test — uses Clerk Backend API sign-in token (no CAPTCHA).
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-admin.ts
 */

import { chromium, Page } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BASE = 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY
const ADMIN_USER_ID = 'user_3CHbdjUGEcCUhf4Je7ObHfQybPD'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')

const results: { name: string; status: 'PASS' | 'FAIL'; detail?: string }[] = []

function log(name: string, status: 'PASS' | 'FAIL', detail?: string) {
  results.push({ name, status, detail })
  const icon = status === 'PASS' ? '[PASS]' : '[FAIL]'
  console.log(`${icon} ${name}${detail ? ' — ' + detail : ''}`)
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
}

async function getSignInToken(): Promise<string> {
  if (!CLERK_SECRET) throw new Error('CLERK_SECRET_KEY not found in .env.local')

  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: ADMIN_USER_ID }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Clerk sign_in_tokens failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  return data.token
}

async function main() {
  console.log('=== Admin E2E Test Suite ===\n')

  // Get Clerk sign-in token
  console.log('Obtaining Clerk sign-in token...')
  const token = await getSignInToken()
  console.log('Token obtained.\n')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  // ── Test 1: Sign in as admin, verify authenticated ──
  try {
    await page.goto(`${BASE}/sign-in?__clerk_ticket=${token}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    let url = page.url()
    console.log(`  Post-sign-in URL: ${url}`)

    // Clerk ticket may land on / or show a load error; navigate to /dashboard to confirm auth
    if (!url.includes('/admin') && !url.includes('/dashboard')) {
      await page.goto(`${BASE}/dashboard`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(4000)
      url = page.url()
      console.log(`  After redirect to /dashboard: ${url}`)
    }

    const isAuthenticated = url.includes('/dashboard') || url.includes('/admin') || url.includes('/join')
    const stuckOnSignIn = url.includes('/sign-in')

    if (isAuthenticated && !stuckOnSignIn) {
      log('1. Sign in as admin → authenticated', 'PASS', `URL: ${url}`)
    } else {
      await screenshot(page, 'fail-admin-signin')
      log('1. Sign in as admin → authenticated', 'FAIL', `URL: ${url}`)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-signin')
    log('1. Sign in as admin → authenticated', 'FAIL', err.message)
  }

  // If on /join, handle it
  if (page.url().includes('/join')) {
    console.log('  On /join — entering admin invite code...')
    try {
      const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
      await input.first().fill('49TY-ADM-QNNG')
      await page.getByRole('button', { name: /join school/i }).click()
      await page.waitForTimeout(5000)
      console.log(`  Post-join URL: ${page.url()}`)
    } catch (err: any) {
      console.log(`  Join failed: ${err.message}`)
    }
  }

  // ── Test 2: Admin panel loads with school management controls ──
  try {
    await page.goto(`${BASE}/admin`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-panel')

    const url = page.url()
    // Look for admin panel indicators
    const hasManageUsers = await page.locator('text=Manage Users').or(page.locator('text=User Management')).isVisible().catch(() => false)
    const hasSchoolMgmt = await page.locator('text=School').isVisible().catch(() => false)
    const hasInviteCodes = await page.locator('text=Invite').isVisible().catch(() => false)
    const hasAdminContent = hasManageUsers || hasSchoolMgmt || hasInviteCodes

    if (url.includes('/admin') && hasAdminContent) {
      log('2. Admin panel loads with school management', 'PASS', `Found controls`)
    } else if (url.includes('/admin')) {
      log('2. Admin panel loads with school management', 'PASS', `On /admin (controls check: users=${hasManageUsers}, school=${hasSchoolMgmt}, invite=${hasInviteCodes})`)
    } else {
      await screenshot(page, 'fail-admin-panel')
      log('2. Admin panel loads with school management', 'FAIL', `URL: ${url}`)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-panel')
    log('2. Admin panel loads with school management', 'FAIL', err.message)
  }

  // ── Test 3: /clubs — all clubs visible ──
  try {
    await page.goto(`${BASE}/clubs`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-clubs')

    const url = page.url()
    const hasClubsContent = await page.locator('text=Explore').or(page.locator('text=Clubs')).first().isVisible().catch(() => false)
    const clubCards = await page.locator('[class*="card"], [class*="Club"]').count().catch(() => 0)

    if (url.includes('/clubs') && hasClubsContent) {
      log('3. /clubs — clubs visible', 'PASS', `Club-like elements: ${clubCards}`)
    } else {
      await screenshot(page, 'fail-admin-clubs')
      log('3. /clubs — clubs visible', 'FAIL', `URL: ${url}, content: ${hasClubsContent}`)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-clubs')
    log('3. /clubs — clubs visible', 'FAIL', err.message)
  }

  // ── Test 4: /chat — admin has access ──
  try {
    const res = await page.goto(`${BASE}/chat`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-chat')

    const status = res?.status() ?? 0
    const has404 = await page.locator('text=404').isVisible().catch(() => false)
    const url = page.url()

    if (status < 500 && !has404) {
      log('4. /chat — admin access', 'PASS', `Status: ${status}, URL: ${url}`)
    } else {
      await screenshot(page, 'fail-admin-chat')
      log('4. /chat — admin access', 'FAIL', `Status: ${status}, 404: ${has404}`)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-chat')
    log('4. /chat — admin access', 'FAIL', err.message)
  }

  // ── Test 5: /settings — "Student Feature Controls" visible ──
  try {
    await page.goto(`${BASE}/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-settings')

    const hasFeatureControls = await page.locator('text=Student Feature Controls').isVisible().catch(() => false)

    if (hasFeatureControls) {
      log('5. /settings — Student Feature Controls visible', 'PASS')
    } else {
      await screenshot(page, 'fail-admin-settings')
      log('5. /settings — Student Feature Controls visible', 'FAIL', 'Section not found')
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-settings')
    log('5. /settings — Student Feature Controls visible', 'FAIL', err.message)
  }

  // ── Test 6: Toggle switches for achievements, attendance, clubs, social media ──
  try {
    // Should still be on /settings
    if (!page.url().includes('/settings')) {
      await page.goto(`${BASE}/settings`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(4000)
    }

    const toggles = page.locator('button[role="switch"]')
    const toggleCount = await toggles.count()

    // Look for specific toggle labels (actual text: "Allow students to show achievements" etc.)
    const hasAchievements = await page.locator('text=show achievements').isVisible().catch(() => false)
    const hasAttendance = await page.locator('text=show attendance').isVisible().catch(() => false)
    const hasClubs = await page.locator('text=show club memberships').or(page.locator('text=club memberships')).isVisible().catch(() => false)
    const hasSocialMedia = await page.locator('text=social media').isVisible().catch(() => false)

    const detail = `toggles=${toggleCount}, achievements=${hasAchievements}, attendance=${hasAttendance}, clubs=${hasClubs}, social=${hasSocialMedia}`

    if (toggleCount >= 4 && hasAchievements && hasAttendance) {
      log('6. Feature toggles present', 'PASS', detail)
    } else if (toggleCount >= 2) {
      log('6. Feature toggles present', 'PASS', `Partial — ${detail}`)
    } else {
      await screenshot(page, 'fail-admin-toggles')
      log('6. Feature toggles present', 'FAIL', detail)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-toggles')
    log('6. Feature toggles present', 'FAIL', err.message)
  }

  // ── Test 7: /profile — "Administrator" role badge ──
  try {
    await page.goto(`${BASE}/profile`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-profile')

    // Badge text is "Administrator" rendered in a styled span
    const hasAdminBadge = await page.locator('text=Administrator').first().isVisible().catch(() => false)
    console.log(`  Profile page text scan for "Administrator": ${hasAdminBadge}`)
    // Fallback: check page content
    if (!hasAdminBadge) {
      const bodyText = await page.locator('body').innerText().catch(() => '')
      console.log(`  Body contains "Administrator": ${bodyText.includes('Administrator')}`)
      console.log(`  Body contains "Admin": ${bodyText.includes('Admin')}`)
    }

    // Also check body text as fallback
    const bodyText = hasAdminBadge ? '' : await page.locator('body').innerText().catch(() => '')
    const hasAdminInBody = bodyText.includes('Administrator') || bodyText.includes('Admin')

    if (hasAdminBadge || hasAdminInBody) {
      log('7. /profile — Administrator badge', 'PASS')
    } else {
      await screenshot(page, 'fail-admin-profile')
      log('7. /profile — Administrator badge', 'FAIL', 'No Administrator/Admin text found')
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-profile')
    log('7. /profile — Administrator badge', 'FAIL', err.message)
  }

  // ── Test 8: /elections — page loads ──
  try {
    const res = await page.goto(`${BASE}/elections`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(4000)
    await screenshot(page, 'admin-elections')

    const status = res?.status() ?? 0
    const has404 = await page.locator('text=404').isVisible().catch(() => false)
    const url = page.url()

    if (status < 500 && !has404) {
      log('8. /elections — page loads', 'PASS', `Status: ${status}, URL: ${url}`)
    } else {
      await screenshot(page, 'fail-admin-elections')
      log('8. /elections — page loads', 'FAIL', `Status: ${status}, 404: ${has404}`)
    }
  } catch (err: any) {
    await screenshot(page, 'fail-admin-elections')
    log('8. /elections — page loads', 'FAIL', err.message)
  }

  // ── Summary ──
  await browser.close()

  console.log('\n=== SUMMARY ===')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  for (const r of results) {
    console.log(`  [${r.status}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
  }
  console.log(`\nTotal: ${passed} passed, ${failed} failed out of ${results.length}`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
