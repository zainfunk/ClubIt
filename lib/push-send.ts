import 'server-only'
import http2 from 'node:http2'
import crypto from 'node:crypto'
import { createServiceClient } from '@/lib/supabase'

/**
 * APNs (Apple Push Notification service) sender.
 *
 * This is intentionally DORMANT until the Apple Developer assets exist. It
 * reads its credentials from env; if any are missing it no-ops (so the rest of
 * the app can call sendPushToUser() unconditionally without crashing prod).
 *
 * To activate (after enrolling in the Apple Developer Program and creating an
 * APNs Auth Key in the developer portal):
 *   APNS_TEAM_ID      — 10-char Apple team id
 *   APNS_KEY_ID       — 10-char key id of the .p8 APNs Auth Key
 *   APNS_AUTH_KEY     — the full contents of the AuthKey_XXXX.p8 file
 *                       (PEM, including the BEGIN/END lines; \n-escaped is fine)
 *   APNS_BUNDLE_ID    — defaults to com.clubit.app
 *   APNS_PRODUCTION   — "true" for the prod APNs host, else sandbox
 *
 * Storage of tokens is migration 0010 (device_push_tokens). Registration is
 * /api/push/register, called from the native shell (lib/push-client.ts).
 */

const TEAM_ID = process.env.APNS_TEAM_ID
const KEY_ID = process.env.APNS_KEY_ID
const AUTH_KEY = process.env.APNS_AUTH_KEY?.replace(/\\n/g, '\n')
const BUNDLE_ID = process.env.APNS_BUNDLE_ID ?? 'com.clubit.app'
const HOST = process.env.APNS_PRODUCTION === 'true'
  ? 'https://api.push.apple.com'
  : 'https://api.sandbox.push.apple.com'

export function pushConfigured(): boolean {
  return Boolean(TEAM_ID && KEY_ID && AUTH_KEY)
}

export interface PushPayload {
  title: string
  body: string
  /** Deep-link path the native shell should route to on tap, e.g. /elections/abc. */
  path?: string
  /** Extra custom data merged into the APNs payload. */
  data?: Record<string, unknown>
}

// APNs provider JWTs are valid for up to 1h; Apple recommends reusing one for
// ~20-50 min rather than minting per-request. Cache it module-side.
let cachedToken: { jwt: string; mintedAtMs: number } | null = null

function providerToken(nowMs: number): string {
  if (cachedToken && nowMs - cachedToken.mintedAtMs < 45 * 60 * 1000) {
    return cachedToken.jwt
  }
  const iat = Math.floor(nowMs / 1000)
  const header = { alg: 'ES256', kid: KEY_ID }
  const claims = { iss: TEAM_ID, iat }
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signingInput = `${enc(header)}.${enc(claims)}`
  // ES256 for JOSE needs the raw r||s signature (ieee-p1363), not DER.
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: AUTH_KEY as string,
    dsaEncoding: 'ieee-p1363',
  })
  const jwt = `${signingInput}.${signature.toString('base64url')}`
  cachedToken = { jwt, mintedAtMs: nowMs }
  return jwt
}

interface SendResult {
  sent: number
  failed: number
  skipped: boolean
}

/** Send one notification to every registered device token for a user. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  if (!pushConfigured()) {
    console.warn('[push] APNs not configured — skipping push to', userId)
    return { sent: 0, failed: 0, skipped: true }
  }

  const db = createServiceClient()
  const { data } = await db
    .from('device_push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('platform', 'ios')

  const tokens = (data ?? []).map((r) => r.token as string)
  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: false }

  const nowMs = Date.now()
  const jwt = providerToken(nowMs)
  const apsBody = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
    ...(payload.path ? { path: payload.path } : {}),
    ...(payload.data ?? {}),
  })

  const session = http2.connect(HOST)
  let sent = 0
  let failed = 0
  const stale: string[] = []

  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = session.request({
              ':method': 'POST',
              ':path': `/3/device/${token}`,
              authorization: `bearer ${jwt}`,
              'apns-topic': BUNDLE_ID,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'content-type': 'application/json',
            })
            let status = 0
            req.on('response', (headers) => {
              status = Number(headers[':status'] ?? 0)
            })
            req.on('end', () => {
              if (status === 200) sent++
              else {
                failed++
                // 410 Gone / 400 BadDeviceToken: token is dead — prune it.
                if (status === 410 || status === 400) stale.push(token)
              }
              resolve()
            })
            req.on('error', () => { failed++; resolve() })
            req.write(apsBody)
            req.end()
          }),
      ),
    )
  } finally {
    session.close()
  }

  if (stale.length > 0) {
    await db.from('device_push_tokens').delete().in('token', stale)
  }

  return { sent, failed, skipped: false }
}
