import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { userId: caller } = await auth()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = request.nextUrl.searchParams.get('userId') ?? caller
  const db = createServiceClient()

  const [attRes, memRes] = await Promise.all([
    db.from('attendance_records').select('duration_minutes').eq('user_id', userId).eq('present', true),
    db.from('memberships').select('hours_adjustment_minutes').eq('user_id', userId),
  ])

  const autoMinutes = (attRes.data ?? []).reduce(
    (sum, r) => sum + ((r.duration_minutes as number | null) ?? DEFAULT_MEETING_MINUTES),
    0,
  )
  const adjustmentMinutes = (memRes.data ?? []).reduce(
    (sum, r) => sum + ((r.hours_adjustment_minutes as number | null) ?? 0),
    0,
  )

  return NextResponse.json({
    autoMinutes,
    adjustmentMinutes,
    totalMinutes: Math.max(0, autoMinutes + adjustmentMinutes),
  })
}
