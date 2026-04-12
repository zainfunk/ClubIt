/**
 * Sanitize user-generated text for safe storage.
 *
 * React's JSX escapes text on render, so this primarily guards against:
 * - Stored XSS if content is later used outside React (emails, exports)
 * - Script injection via attribute contexts (href, src)
 * - Control characters that could break UI rendering
 */

/** Strip HTML tags and encode dangerous characters */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'))
    // Remove zero-width and control characters (keep newlines/tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')
}

/** Sanitize a URL — only allow http(s) and mailto protocols */
export function sanitizeUrl(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return ''
    return trimmed
  } catch {
    // Allow protocol-relative or path-like URLs starting with /
    if (trimmed.startsWith('/')) return trimmed
    // Try prepending https
    try {
      const url = new URL(`https://${trimmed}`)
      if (url.protocol === 'https:') return `https://${trimmed}`
    } catch { /* invalid */ }
    return ''
  }
}

/** Sanitize all string fields in an object (shallow, one level) */
export function sanitizeFields<T extends Record<string, unknown>>(
  obj: T,
  urlFields: string[] = [],
): T {
  const result = { ...obj }
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[key] = urlFields.includes(key)
        ? sanitizeUrl(value)
        : sanitizeText(value.trim())
    }
  }
  return result
}
