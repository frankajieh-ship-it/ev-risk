import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const VALID_OBD_TOOLS = ["leaf_spy", "torque", "obdii_generic", "manufacturer_app", "other"];

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    receiptId,
    vehicleYear,
    vehicleModel,
    vin,
    reportedSohPct,
    obdTool,
    readingDate,
    currentMileage,
    notes,
    anonId,
  } = body as Record<string, unknown>;

  // Validate required fields
  if (!vehicleYear || typeof vehicleYear !== "number") {
    return NextResponse.json({ error: "vehicleYear is required" }, { status: 400 });
  }
  if (!vehicleModel || typeof vehicleModel !== "string" || !vehicleModel.trim()) {
    return NextResponse.json({ error: "vehicleModel is required" }, { status: 400 });
  }
  if (typeof reportedSohPct !== "number" || reportedSohPct < 50 || reportedSohPct > 100) {
    return NextResponse.json({ error: "reportedSohPct must be between 50 and 100" }, { status: 400 });
  }
  if (!readingDate || typeof readingDate !== "string") {
    return NextResponse.json({ error: "readingDate is required" }, { status: 400 });
  }
  const currentYear = new Date().getFullYear();
  if (vehicleYear < 2010 || vehicleYear > currentYear) {
    return NextResponse.json({ error: `vehicleYear must be between 2010 and ${currentYear}` }, { status: 400 });
  }
  if (obdTool && !VALID_OBD_TOOLS.includes(obdTool as string)) {
    return NextResponse.json({ error: "Invalid obdTool value" }, { status: 400 });
  }
  if (currentMileage !== undefined && (typeof currentMileage !== "number" || currentMileage < 0)) {
    return NextResponse.json({ error: "currentMileage must be a non-negative number" }, { status: 400 });
  }

  const resolvedAnonId = typeof anonId === "string" && anonId.trim()
    ? anonId.trim()
    : `anon_${Date.now()}`;

  const { data, error } = await supabase
    .from("soh_submissions")
    .insert({
      receipt_id: typeof receiptId === "string" ? receiptId : null,
      anon_id: resolvedAnonId,
      vehicle_year: vehicleYear,
      vehicle_model: (vehicleModel as string).trim(),
      vin: typeof vin === "string" && vin.trim() ? vin.trim() : null,
      reported_soh_pct: reportedSohPct,
      obd_tool: typeof obdTool === "string" ? obdTool : null,
      reading_date: readingDate,
      current_mileage: typeof currentMileage === "number" ? currentMileage : null,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[SOH Submit] Supabase error:", error);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  // Fire-and-forget analytics event
  void Promise.resolve(supabase.from("user_events").insert({
    event_name: "soh_submitted",
    event_data: {
      vehicle_year: vehicleYear,
      vehicle_model: vehicleModel,
      reported_soh_pct: reportedSohPct,
      obd_tool: obdTool ?? null,
      submission_id: data.id,
    },
    visitor_id: resolvedAnonId,
    page_path: "/report",
  })).catch(() => {});

  return NextResponse.json({ success: true, submissionId: data.id });
}
