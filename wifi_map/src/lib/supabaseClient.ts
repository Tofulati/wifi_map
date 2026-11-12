import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  return client
}

export function supabaseConfigurationMessage(): string | null {
  return getSupabaseClient()
    ? null
    : 'Supabase is not configured; measurements remain available locally.'
}
