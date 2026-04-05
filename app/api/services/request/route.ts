/**
 * POST /api/services/request
 * Public endpoint — no auth required (buyers can be anonymous).
 * Creates a service_request row and associates it with a mechanic.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const {
    mechanic_id,
    service_type,
    vin,
    year,
    make,
    model,
    auction_result_id,
    preferred_date,
    notes,
    contact_name,
    contact_email,
    contact_phone,
    zip,
  } = body as {
    mechanic_id: string;
    service_type: string;
    vin?: string;
    year?: number;
    make?: string;
    model?: string;
    auction_result_id?: string;
    preferred_date?: string;
    notes?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    zip?: string;
  };

  if (!mechanic_id || !service_type) {
    return NextResponse.json(
      { success: false, error: "mechanic_id and service_type are required" },
      { status: 400 }
    );
  }

  // Resolve optional authenticated user
  const user = await getUserFromRequest(req);

  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      mechanic_id,
      buyer_user_id: user?.id ?? null,
      auction_result_id: auction_result_id ?? null,
      vin: vin ?? null,
      year: year ?? null,
      make: make ?? null,
      model: model ?? null,
      service_type,
      preferred_date: preferred_date ?? null,
      notes: notes ?? null,
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
      contact_phone: contact_phone ?? null,
      zip: zip ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[services/request] insert error:", error?.message);
    return NextResponse.json({ success: false, error: "Request failed. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ success: true, request_id: data.id });
}
