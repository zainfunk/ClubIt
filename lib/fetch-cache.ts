/**
 * Lightweight client-side fetch cache with TTL.
 *
 * Caches GET responses in memory so rapid re-mounts (tab switches,
 * back-navigation) don't re-fetch data that hasn't changed.
 */

interface CacheEntry {
  data: unknown
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL_MS = 30_000 // 30 seconds

/**
 * Fetch JSON with in-memory caching.
 * - Returns cached data immediately if within TTL.
 * - De-duplicates concurrent requests to the same URL.
 * - Automatically evicts stale entries on next request.
 */
export async function cachedFetch<T = unknown>(
  url: string,
  opts?: { ttl?: number; bust?: boolean },
): Promise<T> {
  const ttl = opts?.ttl ?? DEFAULT_TTL_MS

  // Return cached data if fresh
  if (!opts?.bust) {
    const entry = cache.get(url)
    if (entry && Date.now() - entry.fetchedAt < ttl) {
      return entry.data as T
    }
  }

  // De-duplicate concurrent requests
  const existing = inflight.get(url)
  if (existing) return existing as Promise<T>

  const promise = fetch(url, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const data = await res.json()
      cache.set(url, { data, fetchedAt: Date.now() })
      return data as T
    })
    .finally(() => {
      inflight.delete(url)
    })

  inflight.set(url, promise)
  return promise
}

/** Invalidate a specific cache entry (e.g., after a mutation) */
export function invalidateCache(url: string) {
  cache.delete(url)
}

/** Invalidate all entries matching a prefix */
export function invalidateCachePrefix(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

/** Clear the entire cache */
export function clearCache() {
  cache.clear()
}
