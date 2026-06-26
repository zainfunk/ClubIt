#!/usr/bin/env node
/**
 * Strip dev-only routes from the source tree before `next build` runs in a
 * production build. This makes them physically absent from the .next/
 * output, not merely runtime-disabled.
 *
 * Closes finding W1.6 from docs/security/ClubIt-Security-Assessment.md.
 *
 * Why: the previous defense was `if (process.env.NODE_ENV !== 'development')`
 * checks at the top of each handler. Three failure modes:
 *   1. Vercel preview deployments default to NODE_ENV=production but a
 *      misconfigured project could leak through.
 *   2. Anyone who wires up a custom build pipeline could accidentally
 *      ship the dev tree.
 *   3. The compiled handlers still exist in .next/ and could be reached
 *      via a Next.js routing bug.
 *
 * This script removes the directories outright. For local dev, run plain
 * `npm run build` (no strip); for production, run `npm run build:prod`
 * which composes strip -> next build -> verify.
 */
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()

// Path is relative to repo root. List drawn from the assessment §C-3 / §H-5
// findings; reconfirm by grepping for `NODE_ENV !== 'development'` before
// every release.
const DEV_PATHS = [
  'app/api/dev',
  'app/dev',
]

const NODE_ENV = process.env.NODE_ENV ?? ''
const FORCE = process.argv.includes('--force')

if (NODE_ENV !== 'production' && !FORCE) {
  console.log(
    `[strip-dev-routes] NODE_ENV=${JSON.stringify(NODE_ENV)} (not "production"); ` +
      `skipping. Pass --force to strip anyway.`,
  )
  process.exit(0)
}

let removed = 0
for (const rel of DEV_PATHS) {
  const abs = resolve(ROOT, rel)
  if (!existsSync(abs)) {
    console.log(`[strip-dev-routes] not present: ${rel}`)
    continue
  }
  try {
    rmSync(abs, { recursive: true, force: true })
    console.log(`[strip-dev-routes] removed:     ${rel}`)
    removed++
  } catch (err) {
    console.error(`[strip-dev-routes] failed:    ${rel}: ${err.message}`)
    process.exit(1)
  }
}

console.log(`[strip-dev-routes] done. removed ${removed}/${DEV_PATHS.length} paths.`)
