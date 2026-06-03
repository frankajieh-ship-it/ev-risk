/**
 * GET /api/receipt/[receiptId]/status
 *
 * Lightweight polling endpoint used by the receipt page to detect when
 * an async AI upgrade (background function) has completed.
 *
 * Returns:
 *   - generation_status: "lite" | "generating" | "full" | "failed"
 *   - receipt: full output_json (only when generation_status === "full")
 *   - sections: on-demand section statuses (only when generation_status === "full")
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";

export const dynamic = "force-dynamic";

// Allow up to 30 polls/min per IP (every 3s × 20 max polls = ~1 min window)
const rateLimiter = new RateLimiter(60 * 1000, 30);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { receiptId } = await params;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!receiptId || !UUID_REGEX.test(receiptId)) {
    return NextResponse.json({ error: "Invalid receipt ID" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: row, error } = await supabase
    .from("receipts")
    .select("generation_status, output_json, sections, created_at")
    .eq("id", receiptId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
  if (!row) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const status = row.generation_status ?? "lite";

  // Only include the full payload once the upgrade is done
  if (status === "full") {
    return NextResponse.json({
      generation_status: status,
      receipt: row.output_json,
      sections: row.sections ?? null,
      created_at: row.created_at,
    });
  }

  // Stale timeout: if stuck in "lite" or "generating" for >3 minutes, mark as failed.
  // Prevents the client from polling indefinitely when the background function crashes
  // before it can update the status itself (e.g., env var missing, unhandled exception).
  const STALE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
  if ((status === "lite" || status === "generating") && row.created_at) {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    if (ageMs > STALE_TIMEOUT_MS) {
      // Fire-and-forget DB update — don't block the response
      supabase
        .from("receipts")
        .update({ generation_status: "failed" })
        .eq("id", receiptId)
        .then(() => {}, () => {});

      return NextResponse.json({
        generation_status: "failed",
        created_at: row.created_at,
        stale_timeout: true,
      });
    }
  }

  return NextResponse.json({
    generation_status: status,
    created_at: row.created_at,
  });
}
