import { test } from '@playwright/test'

/*
 * AUTH SETUP — Run one role at a time:
 *
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "student"
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "advisor"
 *   npx playwright test tests/e2e/auth-setup.spec.ts --headed -g "admin"
 *
 * Each opens the sign-up page pre-filled. You just need to:
 *   1. Click the Cloudflare CAPTCHA checkbox
 *   2. Click Continue
 *   3. If verification code needed — enter it
 *   4. Enter the invite code on /join
 *   5. Press Resume in Playwright Inspector
 */

const BASE = 'https://clubit.vercel.app'
const TS = Date.now()

const ROLES = {
  student: { user: `pw_stu_${TS}`, email: `pw.stu.${TS}@test.dev`, pass: `Test!${TS}x`, code: 'DYPX-STU-HTLM' },
  advisor: { user: `pw_adv_${TS}`, email: `pw.adv.${TS}@test.dev`, pass: `Test!${TS}x`, code: '77ZJ-ADV-6TFG' },
  admin:   { user: `pw_adm_${TS}`, email: `pw.adm.${TS}@test.dev`, pass: `Test!${TS}x`, code: 'YYZG-ADM-8ECE' },
}

for (const [role, creds] of Object.entries(ROLES)) {
  test(`Setup ${role}`, async ({ page }) => {
    test.setTimeout(600_000)

    // Go to sign-up and pre-fill the form
    await page.goto(`${BASE}/sign-up`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.locator('#username-field').fill(creds.user)
    await page.locator('#emailAddress-field').fill(creds.email)
    await page.locator('#password-field').fill(creds.pass)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`  ${role.toUpperCase()} SETUP`)
    console.log(`  Username: ${creds.user}`)
    console.log(`  Email:    ${creds.email}`)
    console.log(`  Invite:   ${creds.code}`)
    console.log(``)
    console.log(`  1. Click the CAPTCHA checkbox`)
    console.log(`  2. Click Continue`)
    console.log(`  3. Complete any verification`)
    console.log(`  4. On /join, enter code: ${creds.code}`)
    console.log(`  5. Once on dashboard → press RESUME`)
    console.log(`${'='.repeat(60)}\n`)

    // Pause for user to complete captcha + verification + join
    await page.pause()

    // Save auth state
    await page.context().storageState({ path: `tests/e2e/.auth/${role}.json` })
    console.log(`[${role}] Auth saved!`)
  })
}
