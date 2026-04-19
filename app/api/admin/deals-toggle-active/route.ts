/**
 * POST /api/admin/deals-toggle-active
 *
 * Toggle is_active for one deal (single) or all inactive deals (bulk).
 *
 * Single: { id: string, is_active: boolean }
 * Bulk:   { bulk: true, is_active: boolean }  — updates ALL rows where is_active != target
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const isActive = body.is_active as boolean;
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
  }

  // Bulk mode — activate/deactivate rows
  // When activating, only flip rows that have make + price populated (otherwise they'd be
  // invisible to the public /api/deals query anyway due to NOT NULL filters).
  if (body.bulk === true) {
    let q = supabase
      .from("curated_deals")
      .update({ is_active: isActive })
      .eq("is_active", !isActive);

    if (isActive) {
      // Only activate rows that will actually appear in the public feed
      q = q.not("make", "is", null).not("price", "is", null).not("vehicle_label", "is", null);
    }

    const { count, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, updated: count ?? 0 });
  }

  // Single row mode
  const id = body.id as string;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required for single-row toggle" }, { status: 400 });
  }

  const { error } = await supabase
    .from("curated_deals")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
