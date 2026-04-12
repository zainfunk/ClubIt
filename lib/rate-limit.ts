interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimitResult {
  success: boolean
  retryAfter?: number
}

const store = new Map<string, RateLimitEntry>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60 * 1000 // 60 seconds
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// Auto-cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    const valid = entry.timestamps.filter((t) => now - t < WINDOW_MS)
    if (valid.length === 0) {
      store.delete(key)
    } else {
      entry.timestamps = valid
    }
  }
}, CLEANUP_INTERVAL_MS)

export function rateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry) {
    store.set(key, { timestamps: [now] })
    return { success: true }
  }

  // Keep only timestamps within the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS)

  if (entry.timestamps.length >= MAX_ATTEMPTS) {
    const oldest = entry.timestamps[0]
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    return { success: false, retryAfter }
  }

  entry.timestamps.push(now)
  return { success: true }
}
