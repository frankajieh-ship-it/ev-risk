/**
 * OFFO Receipt History — Server Retrieval
 *
 * GET /api/receipt/history?anon_id=...&limit=20
 *
 * Returns receipt history from the database for a given session token.
 * Gracefully degrades: returns { entries: [] } on any error.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ReceiptHistoryEntry } from "@/types/receipt";

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [] });
  }

  const url = new URL(req.url);
  const anonId = url.searchParams.get("anon_id");

  if (!anonId || anonId.length < 5) {
    return NextResponse.json(
      { error: "Missing or invalid anon_id" },
      { status: 400 }
    );
  }

  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);

  try {
    const { data, error } = await supabase
      .from("receipts")
      .select("id, created_at, output_json")
      .eq("session_id", anonId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[Receipt History] Query failed:", error?.message);
      return NextResponse.json({ entries: [] });
    }

    const entries: ReceiptHistoryEntry[] = data
      .filter((row) => row.output_json)
      .map((row) => ({
        receipt_id: row.id,
        created_at: row.created_at,
        verdict: row.output_json.verdict,
        year: row.output_json.listing_summary?.year || null,
        make: row.output_json.listing_summary?.make || null,
        model: row.output_json.listing_summary?.model || null,
        price: row.output_json.listing_summary?.price || null,
        receipt: row.output_json,
      }));

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("[Receipt History] Unexpected error:", err);
    return NextResponse.json({ entries: [] });
  }
}
