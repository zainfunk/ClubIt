/**
 * Launch real Chrome, pre-fill sign-up (leave email blank for you to type),
 * then auto-join with invite code.
 *
 * Usage:
 *   npx tsx tests/e2e/setup-account.ts student
 *   npx tsx tests/e2e/setup-account.ts advisor
 *   npx tsx tests/e2e/setup-account.ts admin
 *
 * Steps:
 *   1. Type YOUR real email (username & password are pre-filled)
 *   2. Click CAPTCHA
 *   3. Click Continue
 *   4. Enter the verification code from your email
 *   5. Script auto-joins and saves — browser closes automatically
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const role = process.argv[2] as 'student' | 'advisor' | 'admin'
if (!role || !['student', 'advisor', 'admin'].includes(role)) {
  console.error('Usage: npx tsx tests/e2e/setup-account.ts <student|advisor|admin>')
  process.exit(1)
}

const TS = Date.now()

const ACCOUNTS: Record<string, { username: string; password: string; code: string }> = {
  student: {
    username: `stu_test_${TS}`,
    password: `ClubIt!Test99`,
    code: 'DYPX-STU-HTLM',
  },
  advisor: {
    username: `adv_test_${TS}`,
    password: `ClubIt!Test99`,
    code: '77ZJ-ADV-6TFG',
  },
  admin: {
    username: `adm_test_${TS}`,
    password: `ClubIt!Test99`,
    code: 'YYZG-ADM-8ECE',
  },
}

const account = ACCOUNTS[role]
const AUTH_DIR = 'tests/e2e/.auth'
const AUTH_FILE = path.join(AUTH_DIR, `${role}.json`)
const USER_DATA = path.join('tests/e2e/.chrome-data', role)

async function main() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  fs.rmSync(USER_DATA, { recursive: true, force: true })
  fs.mkdirSync(USER_DATA, { recursive: true })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${role.toUpperCase()} ACCOUNT SETUP`)
  console.log(`  Username: ${account.username}`)
  console.log(`  Password: ${account.password}`)
  console.log(`  Code:     ${account.code}`)
  console.log(``)
  console.log(`  ✏️  Type YOUR real email in the email field`)
  console.log(`  Then click CAPTCHA → Continue → enter verification code`)
  console.log(`  Script auto-joins and auto-saves after that.`)
  console.log(`${'='.repeat(60)}\n`)

  const context = await chromium.launchPersistentContext(USER_DATA, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const page = context.pages()[0] || await context.newPage()

  await page.goto('https://clubit.vercel.app/sign-up')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Pre-fill username and password, leave email empty for the user
  const usernameField = page.locator('#username-field')
  const passwordField = page.locator('#password-field')

  if (await usernameField.isVisible().catch(() => false)) {
    await usernameField.fill(account.username)
  }
  if (await passwordField.isVisible().catch(() => false)) {
    await passwordField.fill(account.password)
  }

  // Focus the email field so user can type right away
  const emailField = page.locator('#emailAddress-field')
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.focus()
  }

  console.log('[✓] Username & password filled — type your email, click CAPTCHA, then Continue')

  // Watch for navigation and auto-handle join
  while (true) {
    await page.waitForTimeout(2000)

    try {
      const url = page.url()

      if (url.includes('/join')) {
        console.log('[✓] On /join page — entering invite code...')
        await page.waitForTimeout(1000)

        const input = page.locator('input[placeholder*="XXXX"]').or(page.locator('input[type="text"]'))
        if (await input.first().isVisible().catch(() => false)) {
          await input.first().fill(account.code)
          console.log(`[✓] Code entered: ${account.code}`)

          const joinBtn = page.getByRole('button', { name: /join school/i })
          if (await joinBtn.isVisible().catch(() => false)) {
            await joinBtn.click()
            console.log('[✓] Clicked Join — waiting for redirect...')
          }
        }
      }

      if (url.includes('/dashboard')) {
        console.log('[✓] On dashboard! Saving auth...')
        await page.waitForTimeout(2000)
        await context.storageState({ path: AUTH_FILE })
        console.log(`[✓] Auth saved to ${AUTH_FILE}`)
        console.log('[✓] Closing in 5 seconds...')
        await page.waitForTimeout(5000)
        await context.close()
        return
      }
    } catch {
      // ignore navigation errors
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
