import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const { error } = await db
    .from('schools')
    .delete()
    .eq('id', id)
    .eq('status', 'pending') // can only reject pending schools

  if (error) return NextResponse.json({ error: 'Failed to reject school' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
