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

  // Validate email format before sending to Supabase
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email.trim())) {
    return { success: false, error: "Please enter a valid email address" };
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const redirectTo = siteUrl ? `${siteUrl}/auth/callback` : undefined;

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
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(redirectAfter?: string): Promise<{ success: boolean; error?: string }> {
  if (!supabaseAuthClient) {
    return { success: false, error: "Auth not configured" };
  }

  // Store redirect so callback page knows where to go
  if (typeof window !== "undefined" && redirectAfter) {
    localStorage.setItem("auth_redirect", redirectAfter);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const { error } = await supabaseAuthClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: siteUrl ? `${siteUrl}/auth/callback` : undefined },
  });

  if (error) {
    console.error("Google OAuth error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
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

/**
 * User role type for B2B platform
 */
export type UserRole = "buyer" | "dealer_admin" | "dealer_user";

/**
 * Extract role from user metadata (set during onboarding)
 */
export function getUserRole(user: User | null): UserRole | null {
  if (!user) return null;
  return (user.user_metadata?.role as UserRole) || null;
}

/**
 * Extract dealer_id from user metadata (set during dealer onboarding)
 */
export function getUserDealerId(user: User | null): string | null {
  if (!user) return null;
  return (user.user_metadata?.dealer_id as string) || null;
}

export type { User, Session };
