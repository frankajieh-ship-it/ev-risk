/**
 * Supabase Client
 *
 * Server-side Supabase client for API routes.
 * Uses service role key for full database access.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Hardcoded to bypass Netlify env var injection issue
// TODO: Revert to env vars once Netlify integration is fixed
const supabaseUrl = "https://acbxnfhcadvrjvftmbci.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjYnhuZmhjYWR2cmp2ZnRtYmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAyMzk3MywiZXhwIjoyMDg0NTk5OTczfQ.PHQGeDMD2R7RWBtZI9u_kfBCRReV4L5YWYnSrUabalo";

let supabaseClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceKey) {
  // Server-side client with service role key (full access)
  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "Supabase environment variables not set. Session tracking will not work."
  );
}

// Export a proxy that throws a helpful error if used without config
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (!supabaseClient) {
      throw new Error(
        "Supabase client not initialized. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables."
      );
    }
    return (supabaseClient as any)[prop];
  },
});

// Helper to check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}
