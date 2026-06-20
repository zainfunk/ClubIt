import { test } from '@playwright/test'

test('Scout sign-up page', async ({ page }) => {
  await page.goto('https://clubit.vercel.app/sign-up')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'tests/e2e/screenshots/signup-page.png', fullPage: true })

  // Log all visible inputs
  const inputs = await page.locator('input').all()
  for (const input of inputs) {
    const visible = await input.isVisible().catch(() => false)
    if (!visible) continue
    const name = await input.getAttribute('name') ?? ''
    const id = await input.getAttribute('id') ?? ''
    const type = await input.getAttribute('type') ?? ''
    const placeholder = await input.getAttribute('placeholder') ?? ''
    console.log(`INPUT: name="${name}" id="${id}" type="${type}" placeholder="${placeholder}"`)
  }

  // Log all buttons
  const buttons = await page.locator('button').all()
  for (const btn of buttons) {
    const visible = await btn.isVisible().catch(() => false)
    if (!visible) continue
    const text = await btn.textContent()
    console.log(`BUTTON: "${text?.trim()}"`)
  }

  // Log all links
  const links = await page.locator('a').all()
  for (const link of links) {
    const visible = await link.isVisible().catch(() => false)
    if (!visible) continue
    const text = await link.textContent()
    const href = await link.getAttribute('href')
    console.log(`LINK: "${text?.trim()}" href="${href}"`)
  }
})
