/**
 * Receipt request idempotency layer
 *
 * Prevents duplicate receipt generation from rapid clicks or retries.
 * Uses a SHA-256 hash of canonical input fields as the dedup key.
 * Cache TTL: 5 minutes — same input within 5 min returns cached response.
 */

import { createHash } from "crypto";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Compute a deterministic hash of receipt input fields.
 * Same anon_id + vehicle + listing text = same hash.
 */
export function computeInputHash(input: {
  anon_id: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  price?: number;
  vin?: string;
  listing_text?: string | null;
}): string {
  const canonical = JSON.stringify({
    a: input.anon_id,
    y: input.year || 0,
    mk: (input.make || "").toLowerCase().trim(),
    md: (input.model || "").toLowerCase().trim(),
    tr: (input.trim || "").toLowerCase().trim(),
    mi: input.mileage || 0,
    pr: input.price || 0,
    vi: (input.vin || "").toUpperCase().trim(),
    lt: (input.listing_text || "").substring(0, 500).trim(),
  });
  return createHash("sha256").update(canonical).digest("hex").substring(0, 32);
}

export type IdempotencyStatus = "new" | "cached" | "processing";

export interface IdempotencyResult {
  status: IdempotencyStatus;
  cachedResponse?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Check if an identical request was recently made.
 * Returns "cached" with output_json if completed within TTL,
 * "processing" if still in-flight, or "new" if no match.
 *
 * Pass skipCache: true to bypass the cache (used by regenerate
 * to force a fresh AI call with the same input).
 */
export async function checkIdempotency(
  inputHash: string,
  skipCache?: boolean
): Promise<IdempotencyResult> {
  if (skipCache) return { status: "new" };
  if (!isSupabaseConfigured()) return { status: "new" };

  try {
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    const { data } = await supabase
      .from("receipt_requests")
      .select("id, status, output_json")
      .eq("input_hash", inputHash)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { status: "new" };

    if (data.status === "completed" && data.output_json) {
      return {
        status: "cached",
        cachedResponse: data.output_json as Record<string, unknown>,
        requestId: data.id,
      };
    }

    if (data.status === "processing") {
      return { status: "processing", requestId: data.id };
    }

    // "failed" entries don't block — allow retry
    return { status: "new" };
  } catch (err) {
    console.error("[Idempotency] Check failed:", err);
    return { status: "new" };
  }
}

/**
 * Claim a request slot by inserting a "processing" row.
 * Returns the row ID for later completion/failure.
 */
export async function claimRequest(
  inputHash: string,
  anonId: string,
  ipHash?: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from("receipt_requests")
      .insert({
        input_hash: inputHash,
        anon_id: anonId,
        ip_hash: ipHash || null,
        status: "processing",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Idempotency] Claim failed:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error("[Idempotency] Claim error:", err);
    return null;
  }
}

/**
 * Mark a request as completed and cache the response.
 */
export async function completeRequest(
  requestRowId: string,
  receiptId: string,
  outputJson: Record<string, unknown>
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabase
      .from("receipt_requests")
      .update({
        status: "completed",
        receipt_id: receiptId,
        output_json: outputJson,
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRowId);
  } catch (err) {
    console.error("[Idempotency] Complete failed:", err);
  }
}

/**
 * Mark a request as failed so the same input can be retried.
 */
export async function failRequest(
  requestRowId: string,
  errorMessage: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabase
      .from("receipt_requests")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", requestRowId);
  } catch (err) {
    console.error("[Idempotency] Fail update error:", err);
  }
  // Log the original error for debugging
  console.error("[Idempotency] Request failed:", errorMessage);
}
