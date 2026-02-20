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
const MAGIC_LINK_COOLDOWN_MS = 60_000;
const COOLDOWN_KEY = "offo_magic_link_last_sent";

export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAuthClient) {
    return { success: false, error: "Auth not configured" };
  }

  // Client-side cooldown to prevent Supabase rate limit errors
  if (typeof window !== "undefined") {
    const lastSent = localStorage.getItem(COOLDOWN_KEY);
    if (lastSent) {
      const elapsed = Date.now() - parseInt(lastSent, 10);
      if (elapsed < MAGIC_LINK_COOLDOWN_MS) {
        const waitSec = Math.ceil((MAGIC_LINK_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          error: `We just sent a link. Check your inbox or wait ${waitSec}s.`,
        };
      }
    }
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
    // Friendly message for rate limit errors
    if (error.message.toLowerCase().includes("rate limit")) {
      return {
        success: false,
        error: "We already sent you a link. Check your inbox (and spam) or wait a minute.",
      };
    }
    return { success: false, error: error.message };
  }

  // Record send time on success
  if (typeof window !== "undefined") {
    localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
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
