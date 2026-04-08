import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let accessTokenResolver: (() => Promise<string | null>) | null = null

export function setSupabaseAccessTokenResolver(
  resolver: (() => Promise<string | null>) | null
) {
  accessTokenResolver = resolver
}

// Client-side: uses the Clerk session token so Supabase can enforce RLS.
export const supabase = createClient(url, anonKey, {
  async accessToken() {
    return accessTokenResolver ? accessTokenResolver() : null
  },
})

// Server-side only: bypasses RLS, never import in client components.
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey)
}

export function createServerSupabaseClient(getAccessToken: () => Promise<string | null>) {
  return createClient(url, anonKey, {
    accessToken: getAccessToken,
  })
}
