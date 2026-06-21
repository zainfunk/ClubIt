import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

// Node runtime: the sender (lib/push-send.ts) uses node:http2 + node:crypto.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Platform = 'ios' | 'android' | 'web'
const PLATFORMS: Platform[] = ['ios', 'android', 'web']

// POST — upsert the caller's device push token. Called from the native shell
// after the OS grants notification permission and returns an APNs token.
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    token?: string
    platform?: string
  }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }
  const platform: Platform = PLATFORMS.includes(body.platform as Platform)
    ? (body.platform as Platform)
    : 'ios'

  const db = createServiceClient()
  // Token is the PK: re-registering the same token just re-points it at the
  // current user (handles device hand-off / re-install) and refreshes the time.
  const { error } = await db.from('device_push_tokens').upsert(
    {
      token,
      user_id: userId,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  )

  if (error) {
    console.error('push token upsert error', error)
    return NextResponse.json({ error: 'Failed to register token' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — drop a device token (sign-out / disabled notifications).
export async function DELETE(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { token?: string }
  const token = body.token?.trim()
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const db = createServiceClient()
  // Scope the delete to the caller so one user can't unregister another's token.
  const { error } = await db
    .from('device_push_tokens')
    .delete()
    .eq('token', token)
    .eq('user_id', userId)

  if (error) {
    console.error('push token delete error', error)
    return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
