import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const CLERK_SECRET = process.env.CLERK_SECRET_KEY!
const BASE = 'http://localhost:3000'

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

async function main() {
  const users = await clerkApi(`/users?email_address=${encodeURIComponent('rithmohanty07+1@gmail.com')}`)
  const userId = users[0].id
  const token = await clerkApi('/sign_in_tokens', 'POST', { user_id: userId })

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const page = await context.newPage()

  await page.goto(`${BASE}/sign-in?__clerk_ticket=${token.token}`)
  await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // Screenshot multiple pages on mobile
  for (const [route, name] of [
    ['/dashboard', 'mobile-dashboard'],
    ['/chat', 'mobile-chat'],
    ['/profile', 'mobile-profile'],
    ['/settings', 'mobile-settings'],
  ] as const) {
    await page.goto(`${BASE}${route}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `tests/e2e/screenshots/${name}.png`, fullPage: false })
  }
  console.log('Screenshot saved to tests/e2e/screenshots/profile-debug.png')

  await browser.close()
}

main().catch((err) => { console.error(err.message); process.exit(1) })
