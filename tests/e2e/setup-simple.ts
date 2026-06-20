/**
 * Simple account setup — opens browser, you do everything, auth is saved.
 *
 * Usage:
 *   npx tsx tests/e2e/setup-simple.ts student
 *   npx tsx tests/e2e/setup-simple.ts advisor
 *   npx tsx tests/e2e/setup-simple.ts admin
 *
 * Steps:
 *   1. Browser opens to sign-up page
 *   2. Sign up, verify, join school — do it all manually
 *   3. Once you're on /dashboard, click "Resume" in the Playwright Inspector
 *   4. Auth is saved automatically
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const role = process.argv[2] as 'student' | 'advisor' | 'admin'
if (!role || !['student', 'advisor', 'admin'].includes(role)) {
  console.error('Usage: npx tsx tests/e2e/setup-simple.ts <student|advisor|admin>')
  process.exit(1)
}

const BASE = 'http://localhost:3000'
const AUTH_DIR = 'tests/e2e/.auth'
const AUTH_FILE = path.join(AUTH_DIR, `${role}.json`)

async function main() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`  ${role.toUpperCase()} SETUP`)
  console.log(`  1. Sign up in the browser`)
  console.log(`  2. Join school with invite code`)
  console.log(`  3. Once on /dashboard → click RESUME`)
  console.log(`${'='.repeat(50)}\n`)

  await page.goto(`${BASE}/sign-up`)
  await page.pause()

  // User clicked Resume — save auth
  await context.storageState({ path: AUTH_FILE })
  console.log(`[✓] Auth saved to ${AUTH_FILE}`)

  await browser.close()
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
