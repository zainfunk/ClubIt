import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase'
import { contactLimiter } from '@/lib/rate-limit'
import { sanitizeText } from '@/lib/sanitize'

/**
 * POST /api/contact
 *
 * Public, unauthenticated sales-inquiry endpoint for the marketing site.
 * ClubIt bills per student, so there is no self-serve checkout — a prospective
 * school fills out /contact and we follow up to quote/invoice. Submissions are
 * stored in `contact_requests` (read from the Supabase dashboard).
 *
 * Locked down like the other public write routes: per-IP rate limiting, zod
 * validation, free-text sanitized, and inserted via the service-role client
 * (the table's RLS denies all direct access).
 */
const ContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('A valid email is required').max(200),
  schoolName: z.string().trim().min(1, 'School name is required').max(200),
  district: z.string().trim().max(200).optional().or(z.literal('')),
  role: z.string().trim().max(60).optional().or(z.literal('')),
  studentCount: z.number().int().min(0).max(1_000_000).optional(),
  message: z.string().trim().max(4000).optional().or(z.literal('')),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const rl = await contactLimiter.check(`ip:${ip}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = ContactSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Invalid submission'
    return NextResponse.json({ error: first }, { status: 400 })
  }

  const { name, email, schoolName, district, role, studentCount, message } = parsed.data

  const db = createServiceClient()
  const { error } = await db.from('contact_requests').insert({
    id: `contact-${randomUUID()}`,
    created_at: new Date().toISOString(),
    name: sanitizeText(name),
    email: sanitizeText(email),
    school_name: sanitizeText(schoolName),
    district: district ? sanitizeText(district) : null,
    role: role ? sanitizeText(role) : null,
    student_count: studentCount ?? null,
    message: message ? sanitizeText(message) : null,
    status: 'new',
  })

  if (error) {
    console.error('contact: insert failed', error)
    return NextResponse.json(
      { error: 'Something went wrong sending your message. Please email us directly.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
