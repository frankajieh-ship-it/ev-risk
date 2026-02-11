/**
 * OFFO Listing Receipt — Event API
 *
 * POST /api/receipt/event
 * Logs client-side receipt events (copy, paid_clicked, regen).
 * Lightweight insert — no rate limiting needed.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const VALID_EVENT_TYPES = ["copy", "paid_clicked", "regen"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const eventType = body.event_type;
  const receiptId = body.receipt_id;
  const receiptToken = body.receipt_token;

  // Validate event_type
  if (!eventType || typeof eventType !== "string" || !VALID_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      { ok: false, error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate receipt_id (UUID format)
  if (!receiptId || typeof receiptId !== "string" || !UUID_REGEX.test(receiptId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing receipt_id (UUID expected)" },
      { status: 400 }
    );
  }

  // Validate receipt_token
  if (!receiptToken || typeof receiptToken !== "string" || receiptToken.length < 5) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid receipt_token" },
      { status: 400 }
    );
  }

  // Insert into receipt_events
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase.from("receipt_events").insert({
        receipt_id: receiptId,
        session_id: receiptToken,
        event_type: eventType,
      });

      if (error) {
        console.error("[Receipt Event API] Insert error:", error.message);
      }
    } catch (err) {
      console.error("[Receipt Event API] Error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
