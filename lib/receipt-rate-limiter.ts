/**
 * Receipt Rate Limiter
 *
 * Two layers:
 * 1. Burst: 5 requests/hour per IP (in-memory)
 * 2. Daily: 1 free receipt/day per receipt_token (Supabase query)
 */

import { RateLimiter } from "@/lib/rate-limiter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const isDev = process.env.NODE_ENV === "development";

// Burst limiter: generous in dev, strict in prod
export const receiptBurstLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour window
  isDev ? 100 : 5
);

const FREE_DAILY_LIMIT = isDev ? 999 : 1;

// In-memory fallback when Supabase is not configured
const dailyLimitFallback = new Map<string, { count: number; resetAt: number }>();

/**
 * Check daily free limit for a receipt token.
 * Uses receipt_events table to count today's generates.
 * Checks client token, server session cookie, and IP hash.
 */
export async function checkDailyLimit(
  receiptToken: string,
  isPro: boolean,
  serverSessionId?: string,
  ipHash?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  if (isPro) {
    return { allowed: true, remaining: 999, resetAt: "" };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const resetAt = tomorrowStart.toISOString();

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      // Check by session_id (client token + server session)
      const orFilters = [`session_id.eq.${receiptToken}`];
      if (serverSessionId) orFilters.push(`session_id.eq.${serverSessionId}`);

      const { count, error } = await supabase
        .from("receipt_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "generate")
        .gte("created_at", todayStart.toISOString())
        .or(orFilters.join(","));

      if (error) {
        console.error("[Receipt Rate Limiter] Supabase query error:", error);
        // Fall through to in-memory
      } else {
        const used = count || 0;
        if (used >= FREE_DAILY_LIMIT) {
          return { allowed: false, remaining: 0, resetAt };
        }
      }

      // Also check by ip_hash (separate query since column may not exist yet)
      if (ipHash) {
        try {
          const { count: ipCount } = await supabase
            .from("receipt_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "generate")
            .eq("ip_hash", ipHash)
            .gte("created_at", todayStart.toISOString());

          if ((ipCount || 0) >= FREE_DAILY_LIMIT) {
            return { allowed: false, remaining: 0, resetAt };
          }
        } catch {
          // ip_hash column may not exist yet — ignore
        }
      }

      // If we got here via Supabase path, calculate remaining
      if (!error) {
        const used = count || 0;
        return {
          allowed: true,
          remaining: Math.max(0, FREE_DAILY_LIMIT - used),
          resetAt,
        };
      }
    } catch (err) {
      console.error("[Receipt Rate Limiter] Error:", err);
    }
  }

  // In-memory fallback
  const key = receiptToken;
  const entry = dailyLimitFallback.get(key);

  if (entry && Date.now() < entry.resetAt) {
    if (entry.count >= FREE_DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt).toISOString(),
      };
    }
    return {
      allowed: true,
      remaining: FREE_DAILY_LIMIT - entry.count,
      resetAt: new Date(entry.resetAt).toISOString(),
    };
  }

  // No entry or expired — create new
  dailyLimitFallback.set(key, {
    count: 0,
    resetAt: tomorrowStart.getTime(),
  });

  return {
    allowed: true,
    remaining: FREE_DAILY_LIMIT,
    resetAt,
  };
}

/**
 * Increment the daily counter after a successful generation.
 * Call this AFTER the receipt is generated, not before.
 */
export function incrementDailyCount(receiptToken: string): void {
  const entry = dailyLimitFallback.get(receiptToken);
  if (entry && Date.now() < entry.resetAt) {
    entry.count++;
  }
}
