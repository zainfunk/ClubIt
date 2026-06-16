import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'
const MAX_BYTES = 3 * 1024 * 1024 // 3MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/**
 * POST /api/user/avatar
 * Uploads a profile picture for the signed-in user to Supabase Storage
 * (service role, so no client-side storage RLS needed) and saves the
 * public URL to users.avatar_url. Returns { avatarUrl }.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type. Use PNG, JPEG, WebP, or GIF.' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 3MB).' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const db = createServiceClient()

  // One stable object per user (overwritten on each upload).
  const path = `${userId}/avatar`
  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('avatar upload error', uploadError)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  // Cache-bust so the new image shows immediately even though the path is stable.
  const base = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  const avatarUrl = `${base}?v=${Date.now()}`

  const { error: updateError } = await db
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)

  if (updateError) {
    console.error('avatar db update error', updateError)
    return NextResponse.json({ error: 'Uploaded but failed to save. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ avatarUrl })
}

/**
 * DELETE /api/user/avatar — remove the signed-in user's profile picture.
 */
export async function DELETE() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  await db.storage.from(BUCKET).remove([`${userId}/avatar`])
  const { error } = await db.from('users').update({ avatar_url: null }).eq('id', userId)
  if (error) return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
