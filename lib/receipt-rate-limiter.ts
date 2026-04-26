/**
 * Receipt Rate Limiter
 *
 * Two layers for free users:
 * 1. Burst: 5 requests/hour per IP (in-memory)
 * 2. Daily: 3 free receipts/day per receipt_token (Supabase query)
 *
 * Buyer Pass holders: 10 receipt credits (from purchases table)
 */

import { RateLimiter } from "@/lib/rate-limiter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isInternalTester, isFreeMode } from "@/lib/rollout-flags";

const isDev = process.env.NODE_ENV === "development";

// Burst limiter: generous in dev, strict in prod
export const receiptBurstLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour window
  isDev ? 100 : 5
);

const FREE_DAILY_LIMIT = isDev ? 999 : 5;

// In-memory fallback when Supabase is not configured
const dailyLimitFallback = new Map<string, { count: number; resetAt: number }>();

/**
 * Check daily free limit for a receipt token.
 * Uses receipt_events table to count today's generates.
 * Checks client token, server session cookie, and IP hash.
 *
 * If the user has a paid Buyer Pass with remaining credits,
 * they bypass the daily limit entirely (credits are checked separately).
 */
export async function checkDailyLimit(
  receiptToken: string,
  isPro: boolean,
  serverSessionId?: string,
  ipHash?: string
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  if (isPro || isInternalTester(receiptToken) || isFreeMode()) {
    return { allowed: true, remaining: 999, resetAt: "" };
  }

  // Check for Buyer Pass credits before applying daily limit
  if (isSupabaseConfigured()) {
    try {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("receipt_credits_total, receipt_credits_used")
        .eq("anon_id", receiptToken)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (purchase && purchase.receipt_credits_total > 0) {
        const remaining = Math.max(0, purchase.receipt_credits_total - purchase.receipt_credits_used);
        if (remaining > 0) {
          return { allowed: true, remaining, resetAt: "" };
        }
        // Credits exhausted — fall through to daily limit
      }
    } catch {
      // Fall through to daily limit check
    }
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

      // If we got here via Supabase path, sync in-memory and return
      if (!error) {
        const used = count || 0;
        // Keep in-memory map in sync so incrementDailyCount works
        dailyLimitFallback.set(receiptToken, {
          count: used,
          resetAt: tomorrowStart.getTime(),
        });
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

/**
 * Restore a receipt credit when generation fails after decrement.
 * Uses optimistic concurrency — safe to call in catch blocks.
 */
export async function restoreReceiptCredit(anonId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("purchase_id, receipt_credits_used")
      .eq("anon_id", anonId)
      .eq("status", "paid")
      .gt("receipt_credits_total", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!purchase || purchase.receipt_credits_used <= 0) return;

    await supabase
      .from("purchases")
      .update({
        receipt_credits_used: purchase.receipt_credits_used - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("purchase_id", purchase.purchase_id)
      .eq("receipt_credits_used", purchase.receipt_credits_used); // Optimistic lock
  } catch (err) {
    console.error("[Receipt Rate Limiter] Credit restore failed:", err);
  }
}

/**
 * Decrement a receipt credit after successful generation.
 * Returns the number of remaining credits, or -1 if no purchase found.
 */
export async function decrementReceiptCredit(anonId: string): Promise<number> {
  if (!isSupabaseConfigured()) return -1;

  try {
    // Find the active Buyer Pass purchase
    const { data: purchase } = await supabase
      .from("purchases")
      .select("purchase_id, receipt_credits_total, receipt_credits_used")
      .eq("anon_id", anonId)
      .eq("status", "paid")
      .gt("receipt_credits_total", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!purchase) return -1;

    const remaining = purchase.receipt_credits_total - purchase.receipt_credits_used;
    if (remaining <= 0) return 0;

    // Increment used count
    const { error } = await supabase
      .from("purchases")
      .update({
        receipt_credits_used: purchase.receipt_credits_used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("purchase_id", purchase.purchase_id)
      .eq("receipt_credits_used", purchase.receipt_credits_used); // Optimistic concurrency

    if (error) {
      console.error("[Receipt Rate Limiter] Credit decrement failed:", error.message);
      return remaining; // Don't block on error
    }

    return remaining - 1;
  } catch (err) {
    console.error("[Receipt Rate Limiter] Credit decrement error:", err);
    return -1;
  }
}
