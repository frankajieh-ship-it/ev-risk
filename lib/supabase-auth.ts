/**
 * Supabase Auth Client
 *
 * Browser-side Supabase client for user authentication.
 * Uses the anon key for client-side auth flows (magic links).
 */

import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabaseAuthClient: SupabaseClient | null = null;

// Only initialize on client side
if (typeof window !== "undefined" && supabaseUrl && supabaseAnonKey) {
  // Debug: Log the Supabase URL being used (remove after confirming fix)
  console.log("[Supabase Auth] Initializing with URL:", supabaseUrl);

  supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Get the Supabase auth client (browser-only)
 */
export function getSupabaseAuthClient(): SupabaseClient | null {
  return supabaseAuthClient;
}

/**
 * Check if Supabase auth is configured
 */
export function isSupabaseAuthConfigured(): boolean {
  return !!supabaseUrl && !!supabaseAnonKey;
}

/**
 * Send magic link email for passwordless auth
 */
export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAuthClient) {
    return { success: false, error: "Auth not configured" };
  }

  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : undefined;

  const { error } = await supabaseAuthClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error("Magic link error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  if (!supabaseAuthClient) return null;

  const { data: { session } } = await supabaseAuthClient.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getUser(): Promise<User | null> {
  if (!supabaseAuthClient) return null;

  const { data: { user } } = await supabaseAuthClient.auth.getUser();
  return user;
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAuthClient) {
    return { success: false, error: "Auth not configured" };
  }

  const { error } = await supabaseAuthClient.auth.signOut();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): (() => void) | undefined {
  if (!supabaseAuthClient) return undefined;

  const { data: { subscription } } = supabaseAuthClient.auth.onAuthStateChange(callback);

  return () => subscription.unsubscribe();
}

export type { User, Session };
