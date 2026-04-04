/**
 * Receipt Pro Access Check
 *
 * Checks pro status exclusively via the user_roles table.
 * The RECEIPT_PRO_EMAILS env var has been removed — plaintext emails in
 * Netlify env are visible to anyone with deploy access. Use the user_roles
 * table instead (INSERT INTO user_roles (user_id, role) VALUES (..., 'pro')).
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function checkIsPro(
  userId?: string,
  // email param kept for call-site compatibility but is no longer used
  _email?: string
): Promise<boolean> {
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
