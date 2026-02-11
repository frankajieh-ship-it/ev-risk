/**
 * Receipt Pro Access Check
 *
 * MVP: env var allowlist + user_roles table lookup.
 * Server-side only.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const PRO_EMAILS_ENV = (process.env.RECEIPT_PRO_EMAILS || "")
  .split(",")
  .filter(Boolean)
  .map((e) => e.toLowerCase());

export async function checkIsPro(
  userId?: string,
  email?: string
): Promise<boolean> {
  if (email && PRO_EMAILS_ENV.includes(email.toLowerCase())) return true;

  if (userId && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role, expires_at")
        .eq("user_id", userId)
        .single();

      if (data && (data.role === "pro" || data.role === "admin")) {
        if (!data.expires_at || new Date(data.expires_at) > new Date())
          return true;
      }
    } catch {
      // not pro
    }
  }

  return false;
}
