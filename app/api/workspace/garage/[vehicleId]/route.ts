/**
 * Garage Vehicle Detail API
 *
 * GET    /api/workspace/garage/{vehicleId} — get single vehicle
 * PATCH  /api/workspace/garage/{vehicleId} — update vehicle
 * DELETE /api/workspace/garage/{vehicleId} — remove from garage
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
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("garage_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Vehicle not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, vehicle: data });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const allowedFields = ["nickname", "notes", "make", "model", "year", "trim"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from("garage_vehicles")
    .update(updates)
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Vehicle not found or update failed" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, vehicle: data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  const { error } = await supabase
    .from("garage_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
