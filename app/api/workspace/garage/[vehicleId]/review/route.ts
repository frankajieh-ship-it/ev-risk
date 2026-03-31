/**
 * Garage Vehicle Review API
 *
 * GET  /api/workspace/garage/[vehicleId]/review — fetch user's review for this vehicle
 * PUT  /api/workspace/garage/[vehicleId]/review — create or update review
 *
 * One review per user per vehicle (upsert). Vehicle must belong to the requesting user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ vehicleId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  // Verify vehicle belongs to this user
  const { data: vehicle } = await supabase
    .from("garage_vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vehicle) {
    return NextResponse.json({ success: false, error: "Vehicle not found" }, { status: 404 });
  }

  const { data: review } = await supabase
    .from("garage_vehicle_reviews")
    .select("*")
    .eq("garage_vehicle_id", vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ success: true, review: review ?? null });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: { rating?: number; review_text?: string; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { rating, review_text, tags } = body;

  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ success: false, error: "rating must be 1–5" }, { status: 400 });
  }

  // Verify vehicle belongs to this user
  const { data: vehicle } = await supabase
    .from("garage_vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!vehicle) {
    return NextResponse.json({ success: false, error: "Vehicle not found" }, { status: 404 });
  }

  const { data: review, error } = await supabase
    .from("garage_vehicle_reviews")
    .upsert(
      {
        garage_vehicle_id: vehicleId,
        user_id: user.id,
        rating,
        review_text: review_text?.trim() || null,
        tags: tags ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "garage_vehicle_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("[review] upsert error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, review });
}
