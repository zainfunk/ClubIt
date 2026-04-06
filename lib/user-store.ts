import { supabase } from '@/lib/supabase'

export async function setName(userId: string, name: string): Promise<void> {
  await supabase.from('user_overrides').upsert(
    { user_id: userId, name: name.trim() },
    { onConflict: 'user_id' }
  )
}

export async function setEmail(userId: string, email: string): Promise<void> {
  await supabase.from('user_overrides').upsert(
    { user_id: userId, email: email.trim() },
    { onConflict: 'user_id' }
  )
}

export async function getOverride(userId: string): Promise<{ name?: string; email?: string }> {
  const { data } = await supabase
    .from('user_overrides')
    .select('name, email')
    .eq('user_id', userId)
    .maybeSingle()
  return data ?? {}
}

/** Sync pass-through — overrides are loaded async per-component via getOverride(). */
export function applyOverrides<T extends { id: string; name: string; email: string }>(user: T): T {
  return user
}
