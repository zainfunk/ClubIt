/**
 * Persistent, per-route rate limiting.
 *
 * Closes finding W3.2 in ClubIt-Security-Assessment.md.
 *
 * The previous in-memory limiter (a single Map) didn't survive serverless
 * cold starts and didn't share state across Vercel isolates -- effectively
 * useless in production. This module:
 *
 *   - Uses @upstash/ratelimit + @upstash/redis when UPSTASH_REDIS_REST_URL
 *     and UPSTASH_REDIS_REST_TOKEN are set in the environment. State is
 *     shared across every invocation.
 *   - Falls back to a process-local in-memory limiter when those vars are
 *     unset -- acceptable on a single dev laptop, NOT for production.
 *     Warns once at module load.
 *
 * Routes import a named limiter (e.g. `joinLimiter`) with the right
 * window + max for that endpoint, then call `.check(key)` and propagate
 * the result.
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  success: boolean
  retryAfter?: number  // seconds until the next allowed request
  remaining?: number
  limit?: number
}

interface LimiterConfig {
  /** Friendly name; used as the Upstash key prefix and in logs. */
  name: string
  /** Max requests per window. */
  max: number
  /** Window size in seconds. */
  windowSeconds: number
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / single-instance only)
// ---------------------------------------------------------------------------

interface InMemoryEntry {
  timestamps: number[]
}

const inMemoryStore = new Map<string, InMemoryEntry>()

function inMemoryCheck(key: string, cfg: LimiterConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = cfg.windowSeconds * 1000
  const entry = inMemoryStore.get(key) ?? { timestamps: [] }
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)
  if (entry.timestamps.length >= cfg.max) {
    const oldest = entry.timestamps[0]
    return {
      success: false,
      retryAfter: Math.ceil((oldest + windowMs - now) / 1000),
      remaining: 0,
      limit: cfg.max,
    }
  }
  entry.timestamps.push(now)
  inMemoryStore.set(key, entry)
  return {
    success: true,
    remaining: cfg.max - entry.timestamps.length,
    limit: cfg.max,
  }
}

// ---------------------------------------------------------------------------
// Upstash-backed limiter (production)
// ---------------------------------------------------------------------------

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

let redis: Redis | null = null
const upstashLimiters = new Map<string, Ratelimit>()

function getUpstashLimiter(cfg: LimiterConfig): Ratelimit | null {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null
  if (!redis) {
    redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  }
  const key = `${cfg.name}:${cfg.max}/${cfg.windowSeconds}`
  let lim = upstashLimiters.get(key)
  if (!lim) {
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(cfg.max, `${cfg.windowSeconds} s`),
      prefix: `clubit_rl_${cfg.name}`,
      analytics: true,
    })
    upstashLimiters.set(key, lim)
  }
  return lim
}

let warnedFallback = false

async function check(key: string, cfg: LimiterConfig): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(cfg)
  if (upstash) {
    const r = await upstash.limit(key)
    return {
      success: r.success,
      retryAfter: r.success ? undefined : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)),
      remaining: r.remaining,
      limit: r.limit,
    }
  }

  if (!warnedFallback) {
    warnedFallback = true
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      console.error(
        '[rate-limit] FATAL CONFIG: UPSTASH_REDIS_REST_URL/_TOKEN not set in ' +
          'production. Falling back to in-memory; rate limits do not survive ' +
          'cold starts and are not shared across instances. Configure Upstash now.',
      )
    } else {
      console.warn('[rate-limit] dev mode: using in-memory limiter')
    }
  }
  return inMemoryCheck(key, cfg)
}

// ---------------------------------------------------------------------------
// Per-route limiters. The buckets are tuned for security, not friendliness:
// any of these can be relaxed by editing the cfg in one place.
// ---------------------------------------------------------------------------

export function makeLimiter(cfg: LimiterConfig) {
  return {
    /** Check the key (typically `<userId>` or `<ip>`) against this limiter. */
    check: (key: string) => check(key, cfg),
    config: cfg,
  }
}

// 1 per IP per hour. School onboarding is a one-shot per IP per day; this
// is generous enough for a typo retry and tight enough that an attacker
// can't squat 100 schools in a minute.
export const onboardLimiter = makeLimiter({ name: 'onboard', max: 3, windowSeconds: 3600 })

// 5 per IP per 15 minutes. Brute-forcing invite codes (>=128 bits of entropy
// after W2.5) is infeasible at this rate.
export const joinLimiter = makeLimiter({ name: 'join', max: 5, windowSeconds: 900 })

// 5 per IP per 15 minutes for the public, unauthenticated setup token route.
export const setupLimiter = makeLimiter({ name: 'setup', max: 5, windowSeconds: 900 })

// 5 per IP per hour for the public, unauthenticated marketing contact form.
// A real prospect submits once; this caps spam/abuse of the open endpoint.
export const contactLimiter = makeLimiter({ name: 'contact', max: 5, windowSeconds: 3600 })

// 10 per user per hour. Stripe Checkout creation is rare; multiple
// retries are usually a stuck client, not a real flow.
export const checkoutLimiter = makeLimiter({ name: 'checkout', max: 10, windowSeconds: 3600 })

// 30 per user per hour. Profile / override edits.
export const profileLimiter = makeLimiter({ name: 'profile', max: 30, windowSeconds: 3600 })

// 60 per user per hour. Superadmin tools should be busy but bounded.
export const superadminLimiter = makeLimiter({ name: 'superadmin', max: 60, windowSeconds: 3600 })

// 20 messages per user per minute. Chat should feel instant, but a script
// shouldn't be able to flood a club (spam to minors).
export const chatLimiter = makeLimiter({ name: 'chat', max: 20, windowSeconds: 60 })

// 10 (un)registrations per user per hour. Caps unbounded device_push_tokens
// growth from a misbehaving / malicious client.
export const pushLimiter = makeLimiter({ name: 'push', max: 10, windowSeconds: 3600 })

// 30 self check-ins per user per hour. A real student checks in a handful of
// times a day; this caps XP-inflation abuse. Only applied to the self-award
// path — advisor roster marking (targetUserId) is not limited.
export const checkinLimiter = makeLimiter({ name: 'checkin', max: 30, windowSeconds: 3600 })

// ---------------------------------------------------------------------------
// Backward-compat shim for the old `rateLimit(key)` function.
// Existing callers in /api/join keep working until they're migrated.
// ---------------------------------------------------------------------------

/** @deprecated Use a named limiter (e.g. `joinLimiter.check(key)`) instead. */
export async function rateLimit(key: string): Promise<RateLimitResult> {
  return check(key, joinLimiter.config)
}
