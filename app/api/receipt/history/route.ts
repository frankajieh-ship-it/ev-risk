/**
 * OFFO Receipt History — Server Retrieval
 *
 * GET /api/receipt/history?anon_id=...&limit=20
 *
 * Returns receipt history from the database for a given session token.
 * Also queries by authenticated user_id (from cookie) as a fallback,
 * so history persists across devices / cleared localStorage.
 * Gracefully degrades: returns { entries: [] } on any error.
 */

import { type NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ReceiptHistoryEntry } from "@/types/receipt";

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [] });
  }

  const url = new URL(req.url);
  const receiptId = url.searchParams.get("receipt_id");
  const anonId = url.searchParams.get("anon_id");

  // Single receipt by ID (for resume from /saved)
  if (receiptId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(receiptId)) {
      return NextResponse.json(
        { error: "Invalid receipt_id format" },
        { status: 400 }
      );
    }

    try {
      const { data, error } = await supabase
        .from("receipts")
        .select("id, created_at, output_json, vin, photo_urls")
        .eq("id", receiptId)
        .single();

      if (error || !data || !data.output_json) {
        return NextResponse.json({ entries: [] });
      }

      const dataVin = (data as Record<string, unknown>).vin as string | null | undefined;
      const dataPhotos = (data as Record<string, unknown>).photo_urls as string[] | null | undefined;
      const receipt = { ...data.output_json, ...(dataVin ? { vin: dataVin } : {}), ...(dataPhotos?.length ? { photo_urls: dataPhotos } : {}) };
      return NextResponse.json({
        entries: [{
          receipt_id: data.id,
          created_at: data.created_at,
          verdict: receipt.verdict,
          year: receipt.listing_summary?.year || null,
          make: receipt.listing_summary?.make || null,
          model: receipt.listing_summary?.model || null,
          price: receipt.listing_summary?.price || null,
          receipt,
        }],
      });
    } catch (err) {
      console.error("[Receipt History] Single receipt error:", err);
      return NextResponse.json({ entries: [] });
    }
  }

  if (!anonId || anonId.length < 5) {
    return NextResponse.json(
      { error: "Missing or invalid anon_id" },
      { status: 400 }
    );
  }

  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);

  // Extract authenticated user_id from Authorization header or cookie
  let authUserId: string | undefined;
  const authHeader = req.headers.get("authorization") || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies.get("sb-access-token")?.value;
  if (accessToken) {
    try {
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      authUserId = user?.id;
    } catch {
      // not authenticated — continue with anon-only query
    }
  }

  // Backfill user_id on receipts and purchases created before auth fix (fire-and-forget)
  if (authUserId && anonId) {
    supabase
      .from("receipts")
      .update({ user_id: authUserId })
      .eq("session_id", anonId)
      .is("user_id", null)
      .then(() => {});
    supabase
      .from("purchases")
      .update({ user_id: authUserId })
      .eq("anon_id", anonId)
      .is("user_id", null)
      .eq("status", "paid")
      .then(() => {});
  }

  try {
    // Query by session_id (existing behavior)
    const { data: sessionData, error: sessionError } = await supabase
      .from("receipts")
      .select("id, created_at, output_json, vin, photo_urls")
      .eq("session_id", anonId)
      .order("created_at", { ascending: false })
      .limit(limit);

    let allData = (sessionError || !sessionData) ? [] : sessionData;

    // If authenticated, also query by user_id and merge
    if (authUserId) {
      const { data: userData } = await supabase
        .from("receipts")
        .select("id, created_at, output_json, vin, photo_urls")
        .eq("user_id", authUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (userData && userData.length > 0) {
        const seen = new Set(allData.map((r) => r.id));
        for (const row of userData) {
          if (!seen.has(row.id)) {
            allData.push(row);
            seen.add(row.id);
          }
        }
        allData.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        allData = allData.slice(0, limit);
      }
    }

    if (sessionError && !authUserId) {
      console.error("[Receipt History] Query failed:", sessionError?.message);
      return NextResponse.json({ entries: [] });
    }

    const entries: ReceiptHistoryEntry[] = allData
      .filter((row) => row.output_json)
      .map((row) => {
        const rowVin = (row as Record<string, unknown>).vin as string | null | undefined;
        const rowPhotos = (row as Record<string, unknown>).photo_urls as string[] | null | undefined;
        const receipt = { ...row.output_json, ...(rowVin ? { vin: rowVin } : {}), ...(rowPhotos?.length ? { photo_urls: rowPhotos } : {}) };
        return {
          receipt_id: row.id,
          created_at: row.created_at,
          verdict: receipt.verdict,
          year: receipt.listing_summary?.year || null,
          make: receipt.listing_summary?.make || null,
          model: receipt.listing_summary?.model || null,
          price: receipt.listing_summary?.price || null,
          receipt,
        };
      });

    return NextResponse.json({ entries });
  } catch (err) {
    console.error("[Receipt History] Unexpected error:", err);
    return NextResponse.json({ entries: [] });
  }
}
