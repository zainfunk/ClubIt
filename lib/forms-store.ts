import { supabase } from '@/lib/supabase'

export async function hasResponded(formId: string, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('form_responses')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', formId)
    .eq('user_id', userId)
  return (count ?? 0) > 0
}

export async function addResponse(formId: string, userId: string): Promise<void> {
  await supabase.from('form_responses').upsert(
    { form_id: formId, user_id: userId, responded_at: new Date().toISOString() },
    { onConflict: 'form_id,user_id' }
  )
}

export async function getResponseCount(formId: string): Promise<number> {
  const { count } = await supabase
    .from('form_responses')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', formId)
  return count ?? 0
}
