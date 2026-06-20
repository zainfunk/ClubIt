/**
 * E2E Chat Test — Student and Advisor cross-role messaging
 *
 * Usage:
 *   PATH="/c/nvm4w/nodejs:$PATH" npx tsx tests/e2e/test-chat.ts
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const BASE = 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY!
const STUDENT_ID = 'user_3CHbN64PDvOusZFkX2JPbVU922B'
const ADVISOR_ID = 'user_3CHbbnP13LUdb8mMrNua5m5yAkO'
const CLUB_ID = 'test-club-1776121463'
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
const TS = Date.now()
const STUDENT_MSG = `Hello from student test ${TS}`
const ADVISOR_MSG = `Hello from advisor test ${TS}`

let passed = 0
let failed = 0

function log(step: number, name: string, ok: boolean, detail?: string) {
  const tag = ok ? 'PASS' : 'FAIL'
  console.log(`[${tag}] Step ${step}: ${name}${detail ? ' — ' + detail : ''}`)
  if (ok) passed++; else failed++
}

async function snap(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
}

async function getSignInToken(userId: string): Promise<string> {
  const res = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Clerk sign_in_tokens failed (${res.status}): ${body}`)
  }
  const data = await res.json()
  return data.token
}

async function signIn(page: Page, userId: string): Promise<void> {
  const token = await getSignInToken(userId)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${token}`)
  // Wait for redirect away from sign-in
  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
}

async function main() {
  if (!CLERK_SECRET) {
    console.error('CLERK_SECRET_KEY not found in .env.local')
    process.exit(1)
  }

  console.log('\n=== CHAT E2E TEST ===\n')

  const browser = await chromium.launch({ channel: 'chrome', headless: true })

  // ─── STUDENT PHASE ──────────────────────────────────────────────
  let studentCtx: BrowserContext | null = null
  let studentPage: Page | null = null

  try {
    // Step 1: Sign in as student
    studentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    studentPage = await studentCtx.newPage()
    await signIn(studentPage, STUDENT_ID)
    log(1, 'Sign in as student', true, `URL: ${studentPage.url()}`)
  } catch (e: any) {
    log(1, 'Sign in as student', false, e.message)
    await browser.close()
    printSummary()
    return
  }

  try {
    // Step 2: Navigate to /chat, verify Chess Club appears
    await studentPage.goto(`${BASE}/chat`)
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(3000)

    // Look for "Chess Club" text in the chat list
    const chessVisible = await studentPage.locator('text=Chess Club').first().isVisible({ timeout: 10_000 }).catch(() => false)
    log(2, 'Chess Club in chat list', chessVisible)
    await snap(studentPage, 'chat-01-student-list')
  } catch (e: any) {
    log(2, 'Chess Club in chat list', false, e.message)
  }

  try {
    // Step 3: Click into Chess Club chat, verify input field
    await studentPage.locator(`a[href="/chat/${CLUB_ID}"]`).first().click().catch(async () => {
      // Fallback: navigate directly
      await studentPage!.goto(`${BASE}/chat/${CLUB_ID}`)
    })
    await studentPage.waitForLoadState('networkidle')
    await studentPage.waitForTimeout(3000)

    const inputVisible = await studentPage.locator('input[placeholder*="Message"]').isVisible({ timeout: 10_000 }).catch(() => false)
    log(3, 'Chat page loads with input field', inputVisible, `URL: ${studentPage.url()}`)
  } catch (e: any) {
    log(3, 'Chat page loads with input field', false, e.message)
  }

  try {
    // Step 4: Type and send a message
    const input = studentPage.locator('input[placeholder*="Message"]')
    await input.fill(STUDENT_MSG)
    await input.press('Enter')
    await studentPage.waitForTimeout(3000)
    log(4, 'Send student message', true)
  } catch (e: any) {
    log(4, 'Send student message', false, e.message)
  }

  try {
    // Step 5: Verify message appears in chat
    // Use getByText for more robust matching inside nested elements
    const msgLocator = studentPage.getByText(STUDENT_MSG, { exact: true })
    await msgLocator.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    const msgVisible = await msgLocator.first().isVisible().catch(() => false)
    log(5, 'Student message visible in chat', msgVisible)
  } catch (e: any) {
    log(5, 'Student message visible in chat', false, e.message)
  }

  try {
    // Step 6: Screenshot
    await snap(studentPage, 'chat-02-student-message-sent')
    log(6, 'Screenshot of chat with student message', true)
  } catch (e: any) {
    log(6, 'Screenshot of chat with student message', false, e.message)
  }

  // Step 7: Close student browser
  try {
    await studentCtx.close()
    log(7, 'Close student browser context', true)
  } catch (e: any) {
    log(7, 'Close student browser context', false, e.message)
  }

  // ─── ADVISOR PHASE ──────────────────────────────────────────────
  let advisorCtx: BrowserContext | null = null
  let advisorPage: Page | null = null

  try {
    // Step 8: Sign in as advisor
    advisorCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    advisorPage = await advisorCtx.newPage()
    await signIn(advisorPage, ADVISOR_ID)
    log(8, 'Sign in as advisor', true, `URL: ${advisorPage.url()}`)
  } catch (e: any) {
    log(8, 'Sign in as advisor', false, e.message)
    await browser.close()
    printSummary()
    return
  }

  try {
    // Step 9: Navigate to chat, verify student message visible
    await advisorPage.goto(`${BASE}/chat/${CLUB_ID}`)
    await advisorPage.waitForLoadState('networkidle')
    await advisorPage.waitForTimeout(5000)

    const studentMsgLocator = advisorPage.getByText(STUDENT_MSG, { exact: true })
    await studentMsgLocator.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
    const studentMsgVisible = await studentMsgLocator.first().isVisible().catch(() => false)
    log(9, 'Student message visible to advisor', studentMsgVisible)
  } catch (e: any) {
    log(9, 'Student message visible to advisor', false, e.message)
  }

  try {
    // Step 10: Advisor sends reply
    const input = advisorPage.locator('input[placeholder*="Message"]')
    await input.fill(ADVISOR_MSG)
    await input.press('Enter')
    await advisorPage.waitForTimeout(3000)
    log(10, 'Send advisor reply', true)
  } catch (e: any) {
    log(10, 'Send advisor reply', false, e.message)
  }

  try {
    // Step 11: Verify both messages visible
    const studentStillLocator = advisorPage.getByText(STUDENT_MSG, { exact: true })
    await studentStillLocator.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    const studentMsgStill = await studentStillLocator.first().isVisible().catch(() => false)
    const advisorMsgLocator = advisorPage.getByText(ADVISOR_MSG, { exact: true })
    await advisorMsgLocator.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    const advisorMsgVisible = await advisorMsgLocator.first().isVisible().catch(() => false)
    const bothVisible = studentMsgStill && advisorMsgVisible
    log(11, 'Both messages visible', bothVisible, `student=${studentMsgStill}, advisor=${advisorMsgVisible}`)
  } catch (e: any) {
    log(11, 'Both messages visible', false, e.message)
  }

  try {
    // Step 12: Screenshot
    await snap(advisorPage, 'chat-03-advisor-both-messages')
    log(12, 'Screenshot of advisor chat with both messages', true)
  } catch (e: any) {
    log(12, 'Screenshot of advisor chat with both messages', false, e.message)
  }

  // Cleanup
  await advisorCtx?.close()
  await browser.close()

  printSummary()
}

function printSummary() {
  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED out of ${passed + failed} steps ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
