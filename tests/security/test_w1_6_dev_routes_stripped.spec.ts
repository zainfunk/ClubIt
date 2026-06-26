/**
 * W1.6 — verify dev-only routes are physically absent from a production
 * build.
 *
 * The slow path (full `next build`) is opt-in via DO_BUILD=1; by default
 * the test exercises the strip script against a temp copy of the source
 * tree, which proves the policy without paying the build cost on every
 * `npm test`.
 *
 * Closes finding W1.6 from docs/security/ClubIt-Security-Assessment.md.
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, cpSync, existsSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(__dirname, '..', '..')

const DEV_PATHS = [
  'app/api/dev',
  'app/dev',
]

describe('W1.6: dev routes are stripped from production builds', () => {
  it('strip-dev-routes.mjs removes every dev path when NODE_ENV=production', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'clubit-strip-'))
    try {
      // Mirror just the `app/` and `scripts/` subtrees -- enough for the
      // strip script to operate, without copying node_modules / .next.
      mkdirSync(join(tmp, 'app'), { recursive: true })
      mkdirSync(join(tmp, 'scripts'), { recursive: true })
      cpSync(join(ROOT, 'app'), join(tmp, 'app'), { recursive: true })
      cpSync(join(ROOT, 'scripts', 'strip-dev-routes.mjs'),
             join(tmp, 'scripts', 'strip-dev-routes.mjs'))

      // Sanity: the dev paths existed in the source we copied.
      for (const p of DEV_PATHS) {
        expect(
          existsSync(join(tmp, p)),
          `pre-condition failed: ${p} not present in source tree`,
        ).toBe(true)
      }

      // Run the strip script with NODE_ENV=production.
      const result = spawnSync(
        process.execPath,
        [join(tmp, 'scripts', 'strip-dev-routes.mjs')],
        {
          cwd: tmp,
          env: { ...process.env, NODE_ENV: 'production' },
          encoding: 'utf8',
        },
      )
      expect(result.status, result.stderr || result.stdout).toBe(0)

      // Every dev path should now be gone.
      for (const p of DEV_PATHS) {
        expect(
          existsSync(join(tmp, p)),
          `${p} was not removed: stdout=${result.stdout}`,
        ).toBe(false)
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('strip-dev-routes.mjs is a no-op when NODE_ENV !== "production"', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'clubit-strip-noop-'))
    try {
      mkdirSync(join(tmp, 'app/api/dev'), { recursive: true })
      mkdirSync(join(tmp, 'scripts'), { recursive: true })
      cpSync(join(ROOT, 'scripts', 'strip-dev-routes.mjs'),
             join(tmp, 'scripts', 'strip-dev-routes.mjs'))

      const result = spawnSync(
        process.execPath,
        [join(tmp, 'scripts', 'strip-dev-routes.mjs')],
        {
          cwd: tmp,
          env: { ...process.env, NODE_ENV: 'development' },
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/skipping/i)
      expect(existsSync(join(tmp, 'app/api/dev'))).toBe(true)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('check-no-dev-routes.mjs flags an .next/ output containing a forbidden path', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'clubit-check-'))
    try {
      // Fake a .next/ tree that wrongly contains app/api/dev.
      mkdirSync(join(tmp, '.next/server/app/api/dev/school-lab'), { recursive: true })
      mkdirSync(join(tmp, 'scripts'), { recursive: true })
      cpSync(join(ROOT, 'scripts', 'check-no-dev-routes.mjs'),
             join(tmp, 'scripts', 'check-no-dev-routes.mjs'))
      // Drop a fake compiled handler so the walker has a file to find.
      // (mkdirSync on the leaf doesn't create a file.)
      const fs = require('node:fs') as typeof import('node:fs')
      fs.writeFileSync(
        join(tmp, '.next/server/app/api/dev/school-lab/route.js'),
        'export async function POST() {}',
      )

      const result = spawnSync(
        process.execPath,
        [join(tmp, 'scripts', 'check-no-dev-routes.mjs')],
        { cwd: tmp, encoding: 'utf8' },
      )
      expect(result.status, 'expected non-zero exit on forbidden path').not.toBe(0)
      expect(result.stderr + result.stdout).toMatch(/dev-route artifact/i)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it.skipIf(process.env.DO_BUILD !== '1')(
    'full build:prod produces no dev-route artifacts (slow; opt-in via DO_BUILD=1)',
    () => {
      // Runs `npm run build:prod` against the actual repo. Only enabled
      // when DO_BUILD=1 because it touches .next/ and takes minutes.
      const result = spawnSync(
        'npm',
        ['run', 'build:prod'],
        { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' },
      )
      expect(result.status, result.stderr).toBe(0)
    },
  )
})
