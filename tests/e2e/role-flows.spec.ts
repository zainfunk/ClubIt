import { test, expect, Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'

/*
 * ROLE FLOWS — end-to-end smoke for student / advisor / admin.
 *
 * Bypasses Clerk's email-verification + CAPTCHA by:
 *   1. Creating users via Clerk's Backend API with skip_password_checks
 *   2. Signing them in via short-lived sign_in_tokens (one-shot tickets)
 *
 * Each run seeds a brand-new school with non-expiring invite codes via the
 * Supabase service-role client. Admin and advisor codes are single-use, so
 * a fresh school per run is required.
 *
 * Required env (loaded from .env.local in playwright.config.ts):
 *   CLERK_SECRET_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npx playwright test tests/e2e/role-flows.spec.ts
 *   npx playwright test tests/e2e/role-flows.spec.ts --headed         # watch it
 *   npx playwright test tests/e2e/role-flows.spec.ts -g "advisor"     # one role
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const CLERK_SECRET = process.env.CLERK_SECRET_KEY
if (!CLERK_SECRET) {
  throw new Error('CLERK_SECRET_KEY missing — add it to .env.local')
}
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA_URL || !SUPA_KEY) {
  throw new Error('Supabase URL / service-role key missing — add to .env.local')
}

const SAFE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function shortToken(len = 8) {
  let out = ''
  for (let i = 0; i < len; i++) out += SAFE_ALPHABET[randomInt(0, SAFE_ALPHABET.length)]
  return out
}

interface SeededSchool {
  id: string
  name: string
  studentCode: string
  advisorCode: string
  adminCode: string
}

async function seedTestSchool(): Promise<SeededSchool> {
  const db = createClient(SUPA_URL!, SUPA_KEY!)
  const stamp = Date.now()
  const studentCode = `STU-${shortToken()}`
  const advisorCode = `ADV-${shortToken()}`
  const adminCode = `ADM-${shortToken()}`
  const { data, error } = await db
    .from('schools')
    .insert({
      name: `pw-test-${stamp}`,
      contact_name: 'Playwright Setup',
      contact_email: `pw-${stamp}@clubit-test.dev`,
      status: 'active',
      student_invite_code: studentCode,
      advisor_invite_code: advisorCode,
      admin_invite_code: adminCode,
      // Explicit nulls so codes never expire during this run.
      student_code_expires_at: null,
      advisor_code_expires_at: null,
      admin_code_expires_at: null,
      student_code_email_domain: null,
      advisor_code_email_domain: null,
      admin_code_email_domain: null,
    })
    .select('id, name')
    .single()
  if (error || !data) throw new Error(`seed school failed: ${error?.message}`)
  return { id: data.id, name: data.name, studentCode, advisorCode, adminCode }
}

// Lazily seeded once for the whole run. A single shared school is fine
// because each role uses a distinct code.
let SCHOOL: SeededSchool | null = null
let schoolPromise: Promise<SeededSchool> | null = null
async function ensureSchool(): Promise<SeededSchool> {
  if (SCHOOL) return SCHOOL
  if (!schoolPromise) {
    schoolPromise = seedTestSchool().then((s) => {
      SCHOOL = s
      console.log(`[setup] seeded school ${s.name} (${s.id})`)
      console.log(`[setup]   student=${s.studentCode} advisor=${s.advisorCode} admin=${s.adminCode}`)
      return s
    })
  }
  return schoolPromise
}

type Role = 'student' | 'advisor' | 'admin'

interface Account {
  email: string
  username: string
  password: string
  code: string
  expectedLandingPath: RegExp
}

// Use a per-run timestamp so reruns don't collide on Clerk-side username
// uniqueness.
const RUN_ID = Date.now()

// Note: account.code is filled in once SCHOOL is seeded (in beforeAll).
const ACCOUNTS: Record<Role, Omit<Account, 'code'> & { code?: string }> = {
  student: {
    email: `pw_stu_${RUN_ID}@clubit-test.dev`,
    username: `pw_stu_${RUN_ID}`,
    password: `Pw_${RUN_ID}_StuOK!`,
    expectedLandingPath: /\/dashboard/,
  },
  advisor: {
    email: `pw_adv_${RUN_ID}@clubit-test.dev`,
    username: `pw_adv_${RUN_ID}`,
    password: `Pw_${RUN_ID}_AdvOK!`,
    expectedLandingPath: /\/dashboard/,
  },
  admin: {
    email: `pw_adm_${RUN_ID}@clubit-test.dev`,
    username: `pw_adm_${RUN_ID}`,
    password: `Pw_${RUN_ID}_AdmOK!`,
    // Join always redirects to /dashboard; the admin sees a "go to Admin
    // Panel" link there. The admin-specific test below visits /admin
    // directly to verify the panel renders.
    expectedLandingPath: /\/dashboard/,
  },
}

// ── Clerk Backend API helpers ────────────────────────────────────────────────

async function clerkFetch(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { res, body }
}

async function ensureClerkUser(account: Account): Promise<string> {
  const { res: lookupRes, body: lookupBody } = await clerkFetch(
    `/users?email_address=${encodeURIComponent(account.email)}`,
  )
  if (lookupRes.ok && Array.isArray(lookupBody) && lookupBody.length > 0) {
    return (lookupBody[0] as { id: string }).id
  }
  const { res, body } = await clerkFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [account.email],
      username: account.username,
      password: account.password,
      skip_password_checks: true,
    }),
  })
  if (!res.ok) {
    throw new Error(`Clerk user create failed: ${JSON.stringify(body)}`)
  }
  return (body as { id: string }).id
}

async function deleteClerkUser(userId: string) {
  await clerkFetch(`/users/${userId}`, { method: 'DELETE' }).catch(() => undefined)
}

async function getSignInTicket(userId: string): Promise<string> {
  const { res, body } = await clerkFetch('/sign_in_tokens', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
  if (!res.ok) {
    throw new Error(`Sign-in token failed: ${JSON.stringify(body)}`)
  }
  const url = new URL((body as { url: string }).url)
  const ticket = url.searchParams.get('__clerk_ticket')
  if (!ticket) throw new Error('No __clerk_ticket on returned URL')
  return ticket
}

// ── Test driver ──────────────────────────────────────────────────────────────

async function signInWithTicket(page: Page, userId: string) {
  const ticket = await getSignInTicket(userId)
  await page.goto(`${BASE}/sign-in?__clerk_ticket=${ticket}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
}

async function joinSchool(page: Page, code: string) {
  await page.goto(`${BASE}/join`)
  await page.waitForLoadState('networkidle')
  // If they're somehow already in a school, /join redirects away — bail.
  if (!page.url().includes('/join')) return
  const codeInput = page.locator('input[placeholder*="STU"]').or(page.locator('input[type="text"]')).first()
  await codeInput.waitFor({ state: 'visible', timeout: 15_000 })
  await codeInput.fill(code)
  await page.getByRole('button', { name: /join school/i }).click()
}

// ── Specs ────────────────────────────────────────────────────────────────────

for (const role of Object.keys(ACCOUNTS) as Role[]) {
  test.describe(`Role: ${role}`, () => {
    let userId: string
    const account = ACCOUNTS[role]

    test.beforeAll(async () => {
      const school = await ensureSchool()
      account.code = role === 'student' ? school.studentCode
        : role === 'advisor' ? school.advisorCode
        : school.adminCode
      userId = await ensureClerkUser(account as Account)
    })

    test.afterAll(async () => {
      // Clean up the ephemeral Clerk user so reruns don't accumulate accounts.
      // The DB row in Supabase persists; that's by design (audit trail).
      await deleteClerkUser(userId)
    })

    test(`signs in, joins as ${role}, lands on ${account.expectedLandingPath}`, async ({ page }) => {
      test.setTimeout(120_000)

      await signInWithTicket(page, userId)
      await joinSchool(page, account.code!)

      // Expect to land on the role-appropriate landing page.
      await page.waitForURL(account.expectedLandingPath, { timeout: 30_000 })
      expect(page.url()).toMatch(account.expectedLandingPath)
    })

    if (role === 'advisor') {
      test('advisor sees Create-a-club button on dashboard', async ({ page }) => {
        test.setTimeout(120_000)
        await signInWithTicket(page, userId)
        await page.goto(`${BASE}/dashboard`)
        await page.waitForLoadState('networkidle')
        await expect(page.getByRole('button', { name: /create.*club/i }).first()).toBeVisible()
      })
    }

    if (role === 'admin') {
      test('admin sees Admin Panel and no Billing nav entry', async ({ page }) => {
        test.setTimeout(120_000)
        await signInWithTicket(page, userId)
        await page.goto(`${BASE}/admin`)
        await page.waitForLoadState('networkidle')
        // Admin nav entry should be visible
        await expect(page.getByRole('link', { name: /^Admin$/i }).first()).toBeVisible()
        // Billing nav entry should be gone
        await expect(page.getByRole('link', { name: /Billing/i })).toHaveCount(0)
      })
    }
  })
}
