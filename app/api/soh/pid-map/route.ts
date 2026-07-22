/**
 * GET /api/soh/pid-map?make=Nissan&model=LEAF&year=2022
 *
 * Public endpoint — returns the PID profile for a given vehicle.
 * Called by the mobile PWA after VIN decode to know which OBD commands to send.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const yearStr = searchParams.get("year");

  if (!make || !model || !yearStr) {
    return NextResponse.json({ error: "make, model, and year are required" }, { status: 400 });
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) return NextResponse.json({ error: "year must be a number" }, { status: 400 });

  const { data, error } = await supabase
    .from("soh_pid_maps")
    .select("pid_profile, protocol, pids, soh_field, soh_formula, notes")
    .ilike("make", make)
    .ilike("model", model)
    .lte("year_min", year)
    .gte("year_max", year)
    .single();

  if (error || !data) {
    return NextResponse.json({
      supported: false,
      message: `No PID profile found for ${year} ${make} ${model}. This vehicle may not yet be supported for OBD SOH scanning.`,
    });
  }

  return NextResponse.json({
    supported: true,
    ...data,
  });
}
