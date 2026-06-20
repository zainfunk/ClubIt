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
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`) })
  await page.goto(`http://localhost:3000/sign-in?__clerk_ticket=${token.token}`)
  await page.waitForTimeout(3000)
  const pages = ['/dashboard', '/clubs', '/chat', '/elections', '/profile', '/settings', '/clubs/test-club-1776121463']
  for (const p of pages) {
    console.log(`Testing ${p}...`)
    await page.goto(`http://localhost:3000${p}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }
  await browser.close()
  const hookErrors = errors.filter(e => e.toLowerCase().includes('hook') || e.includes('Rendered more'))
  if (hookErrors.length) { console.log('\nHOOK ERRORS:'); hookErrors.forEach(e => console.log(' ', e)) }
  else { console.log('\nNO HOOK ERRORS') }
  console.log(`Total console errors: ${errors.length}`)
  if (errors.length) { errors.slice(0, 5).forEach(e => console.log(' ', e.slice(0, 200))) }
}
main().catch(e => { console.error(e.message); process.exit(1) })
