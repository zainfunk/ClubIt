import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/schools-store'
import { requireSuperAdmin } from '@/lib/auth/require-superadmin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')

  // Codes are infinitely reusable and never expire (simplified model 2026-06-26),
  // so regenerating just swaps the three code strings — no expiry, no single-use
  // markers. Rotating a code immediately invalidates the old one.
  //
  // Try updating all three codes. If advisor_invite_code column doesn't exist yet
  // (migration not applied), fall back to updating just student and admin codes.
  const { error } = await db
    .from('schools')
    .update({
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
    })
    .eq('id', id)

  if (error) {
    // Check if it's a missing-column error (migration not yet applied to this DB)
    const isMissingColumn =
      error.message?.includes('advisor_invite_code') ||
      error.code === '42703' // PostgreSQL undefined_column

    if (!isMissingColumn) {
      return NextResponse.json({ error: 'Failed to regenerate codes' }, { status: 500 })
    }

    // Fallback: update just student + admin codes
    const { error: fallbackError } = await db
      .from('schools')
      .update({ student_invite_code: studentCode, admin_invite_code: adminCode })
      .eq('id', id)

    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to regenerate codes' }, { status: 500 })
    }

    return NextResponse.json({ studentInviteCode: studentCode, adminInviteCode: adminCode, advisorInviteCode: null })
  }

  return NextResponse.json({ studentInviteCode: studentCode, adminInviteCode: adminCode, advisorInviteCode: advisorCode })
}
