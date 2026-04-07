import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side — uses anon key, respects RLS once JWT bridge is configured
export const supabase = createClient(url, anonKey)

// Server-side only — bypasses RLS, never import in client components
// Used in API routes to enforce tenant isolation at the application layer
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}
