import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Personal-project sign-in via Supabase (email + password only).
 * Accounts are created manually in the Supabase dashboard — the app has no
 * sign-up surface. Browser builds can only read VITE_-prefixed vars, so set
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (any other names
 * stay server-side and the login screen will report them as missing).
 */
function readEnv(): { url?: string; anonKey?: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  const url = env.VITE_SUPABASE_URL?.trim() || undefined;
  const anonKey =
    env.VITE_SUPABASE_ANON_KEY?.trim() ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    undefined;
  return { url, anonKey };
}

export function supabaseConfig(): { url?: string; anonKey?: string; configured: boolean } {
  const { url, anonKey } = readEnv();
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

let client: SupabaseClient | null = null;

/** Shared browser client (supabase-js persists the session in localStorage). */
export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, configured } = supabaseConfig();
  if (!configured || !url || !anonKey) return null;
  client ??= createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
