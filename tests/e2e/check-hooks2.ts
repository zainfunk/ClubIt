import { chromium } from 'playwright'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })
const CLERK_SECRET = process.env.CLERK_SECRET_KEY!
async function main() {
  const users = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent('rithmohanty07+1@gmail.com')}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET}` }
  }).then(r => r.json())
  const token = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
    method: 'POST', headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: users[0].id })
  }).then(r => r.json())
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const pages = ['/dashboard', '/clubs', '/chat', '/elections', '/profile', '/settings', '/clubs/test-club-1776121463']
  for (const p of pages) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    let hookError = false
    page.on('pageerror', e => { if (e.message.includes('hooks') || e.message.includes('Rendered more')) hookError = true })
    // Fresh sign-in each time
    await page.goto(`http://localhost:3000/sign-in?__clerk_ticket=${token.token}`)
    await page.waitForTimeout(2000)
    await page.goto(`http://localhost:3000${p}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    console.log(`${p}: ${hookError ? 'HOOK ERROR' : 'OK'}`)
    await context.close()
    // Need a new token for each context
    const t2 = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
      method: 'POST', headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: users[0].id })
    }).then(r => r.json())
    token.token = t2.token
  }
  await browser.close()
}
main().catch(e => { console.error(e.message); process.exit(1) })
