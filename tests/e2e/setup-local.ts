/**
 * Local account setup — creates test accounts using email + aliases.
 *
 * Usage:
 *   npx tsx tests/e2e/setup-local.ts student
 *   npx tsx tests/e2e/setup-local.ts advisor
 *   npx tsx tests/e2e/setup-local.ts admin
 *
 * Steps:
 *   1. Script pre-fills username, email, and password
 *   2. You: click CAPTCHA → Continue → enter verification code from email
 *   3. On /join, script auto-enters the invite code
 *   4. Once on dashboard, auth is saved automatically
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const role = process.argv[2] as 'student' | 'advisor' | 'admin'
if (!role || !['student', 'advisor', 'admin'].includes(role)) {
  console.error('Usage: npx tsx tests/e2e/setup-local.ts <student|advisor|admin>')
  process.exit(1)
}

const BASE = 'http://localhost:3000'

const ACCOUNTS: Record<string, { username: string; email: string; password: string; code: string }> = {
  student: {
    username: `pw_stu_${Date.now()}`,
    email: `rithmohanty07+stu${Date.now()}@gmail.com`,
    password: 'ClubIt!Test99',
    code: 'DYPX-STU-HTLM',
  },
  advisor: {
    username: `pw_adv_${Date.now()}`,
    email: `rithmohanty07+adv${Date.now()}@gmail.com`,
    password: 'ClubIt!Test99',
    code: '9LCW-ADV-TFCU',
  },
  admin: {
    username: `pw_adm_${Date.now()}`,
    email: `rithmohanty07+adm${Date.now()}@gmail.com`,
    password: 'ClubIt!Test99',
    code: '49TY-ADM-QNNG',
  },
}

const account = ACCOUNTS[role]
const AUTH_DIR = 'tests/e2e/.auth'
const AUTH_FILE = path.join(AUTH_DIR, `${role}.json`)
const USER_DATA = path.join('tests/e2e/.chrome-data', `${role}-${Date.now()}`)

async function main() {
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  try { fs.rmSync(USER_DATA, { recursive: true, force: true }) } catch {}
  fs.mkdirSync(USER_DATA, { recursive: true })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${role.toUpperCase()} ACCOUNT SETUP (LOCAL)`)
  console.log(`  Username: ${account.username}`)
  console.log(`  Email:    ${account.email}`)
  console.log(`  Password: ${account.password}`)
  console.log(`  Code:     ${account.code}`)
  console.log(``)
  console.log(`  1. Click the CAPTCHA checkbox`)
  console.log(`  2. Click Continue`)
  console.log(`  3. Enter the verification code from your email`)
  console.log(`  4. Script auto-joins and saves auth`)
  console.log(`${'='.repeat(60)}\n`)

  const context = await chromium.launchPersistentContext(USER_DATA, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ['--disable-blink-features=AutomationControlled'],
  })

  const page = context.pages()[0] || await context.newPage()

  await page.goto(`${BASE}/sign-up`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Pre-fill all fields
  const usernameField = page.locator('#username-field')
  const emailField = page.locator('#emailAddress-field')
  const passwordField = page.locator('#password-field')

  if (await usernameField.isVisible().catch(() => false)) {
    await usernameField.fill(account.username)
  }
  if (await emailField.isVisible().catch(() => false)) {
    await emailField.fill(account.email)
  }
  if (await passwordField.isVisible().catch(() => false)) {
    await passwordField.fill(account.password)
  }

  console.log('[✓] All fields filled — click CAPTCHA, then Continue')

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
        console.log('[✓] Closing in 3 seconds...')
        await page.waitForTimeout(3000)
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
