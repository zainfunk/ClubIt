import { NextRequest } from 'next/server'

// CSP violation sink. Referenced by `report-uri` in next.config.ts. Browsers
// POST application/csp-report (or application/reports+json) here whenever a
// directive is violated under the report-only policy. We just acknowledge with
// 204 so the console doesn't fill with 404s; in dev we log the directive so
// real violations are still visible while triaging.
export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const body = await request.json() as { 'csp-report'?: Record<string, unknown> } | Record<string, unknown>[]
      const violation = Array.isArray(body)
        ? body[0]?.body
        : (body as { 'csp-report'?: Record<string, unknown> })['csp-report']
      if (violation) {
        const v = violation as { 'violated-directive'?: string; 'blocked-uri'?: string; effectiveDirective?: string; blockedURL?: string }
        const directive = v['violated-directive'] ?? v.effectiveDirective ?? 'unknown'
        const blocked = v['blocked-uri'] ?? v.blockedURL ?? '<inline>'
        console.warn(`[csp] ${directive} blocked ${blocked}`)
      }
    } catch { /* malformed payload — ignore */ }
  }
  return new Response(null, { status: 204 })
}
