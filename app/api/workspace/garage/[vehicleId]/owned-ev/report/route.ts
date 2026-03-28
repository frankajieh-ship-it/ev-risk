/**
 * Owned EV Report API
 *
 * POST /api/workspace/garage/[vehicleId]/owned-ev/report
 *   Generate or refresh a routine_health or sellers_report for an owned EV.
 *
 * GET  /api/workspace/garage/[vehicleId]/owned-ev/report?type=routine_health
 *   Return the latest stored report.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { computeRoutineFitV2 } from "@/lib/compute-routine-fit-v2";
import { trackServerEvent } from "@/lib/track-server-event";
import type { MinimumViableRoutine } from "@/types/v2";

type Params = { params: Promise<{ vehicleId: string }> };

const DB_ERROR = NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });

// ============================================
// GET — return latest stored report
// ============================================

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const reportType = req.nextUrl.searchParams.get("type") || "routine_health";

  const supabase = getSupabaseAdmin();
  if (!supabase) return DB_ERROR;

  const { data, error } = await supabase
    .from("owned_ev_reports")
    .select("*")
    .eq("user_id", user.id)
    .eq("garage_vehicle_id", vehicleId)
    .eq("report_type", reportType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ success: false, error: "Report not yet generated" }, { status: 404 });
  }

  return NextResponse.json({ success: true, report: data });
}

// ============================================
// POST — generate or refresh a report
// ============================================

export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { vehicleId } = await params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return DB_ERROR;

  const body = await req.json();
  const reportType: "routine_health" | "sellers_report" = body.report_type || "routine_health";

  if (!["routine_health", "sellers_report"].includes(reportType)) {
    return NextResponse.json({ success: false, error: "Invalid report_type" }, { status: 400 });
  }

  // 1. Load the garage vehicle — must be owned by this user
  const { data: vehicle, error: vehicleError } = await supabase
    .from("garage_vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .eq("is_owned_ev", true)
    .single();

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { success: false, error: "Owned EV not found. Mark this vehicle as owned first." },
      { status: 404 }
    );
  }

  if (!vehicle.make || !vehicle.model) {
    return NextResponse.json(
      { success: false, error: "Vehicle is missing make/model — cannot generate report." },
      { status: 422 }
    );
  }

  // 2. For sellers_report, check entitlement
  if (reportType === "sellers_report") {
    const { data: entitlement } = await supabase
      .from("owned_ev_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("garage_vehicle_id", vehicleId)
      .eq("entitlement_type", "sellers_report_pdf")
      .maybeSingle();

    if (!entitlement) {
      return NextResponse.json(
        { success: false, error: "Sellers Report not unlocked. Purchase required.", code: "payment_required" },
        { status: 402 }
      );
    }
  }

  // 3. Load latest routine_profile for this user
  const { data: profileRows } = await supabase
    .from("routine_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const profile = profileRows?.[0] || null;

  // 4. Fetch NHTSA recalls
  let recalls: Array<{ title: string; severity: string; routine_impact: string; campaign_number: string }> = [];
  try {
    const nhtsaUrl = new URL(
      `/api/recalls/nhtsa?make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}${vehicle.year ? `&year=${vehicle.year}` : ""}`,
      req.nextUrl.origin
    );
    const nhtsaRes = await fetch(nhtsaUrl.toString());
    if (nhtsaRes.ok) {
      const nhtsaData = await nhtsaRes.json();
      recalls = (nhtsaData.recalls || []).slice(0, 5).map((r: Record<string, string>) => ({
        title: r.Component || "Recall",
        severity: "medium",
        routine_impact: r.Consequence ? r.Consequence.slice(0, 100) : "May require a service visit",
        campaign_number: r.NHTSACampaignNumber || "",
      }));
    }
  } catch {
    // Non-fatal — continue without recalls
  }

  // 5. Build routine for scoring — use profile if available, otherwise neutral defaults
  const routine: MinimumViableRoutine = profile
    ? {
        charging_access: (profile.home_charging as "home" | "work" | "public") || "home",
        weekly_miles: profile.weekly_miles || 150,
        commute_miles_roundtrip: profile.commute_miles_roundtrip || undefined,
        climate: (profile.climate_band as "winter" | "mild" | "hot") || "mild",
        longest_day_pattern:
          (profile.longest_day_pattern as "once_a_week" | "monthly_trip" | "rare_road_trip") || "monthly_trip",
        parking_exposure: "garage",
      }
    : {
        charging_access: "home",
        weekly_miles: 150,
        climate: "mild",
        longest_day_pattern: "monthly_trip",
        parking_exposure: "garage",
      };

  // 6. Score routine fit
  const fitResult = computeRoutineFitV2({ routine });

  // 7. Build output payload
  const vinRedacted = vehicle.vin
    ? vehicle.vin.slice(0, 3) + "****" + vehicle.vin.slice(-4)
    : null;

  const vehicleSummary = {
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim || null,
    vin_redacted: vinRedacted,
  };

  const dailyMiles = routine.commute_miles_roundtrip || Math.round((routine.weekly_miles || 150) / 5);
  const chargingNote =
    routine.charging_access === "home"
      ? "Home charging covers your daily pattern with no friction."
      : routine.charging_access === "work"
      ? "Workplace charging supplements your daily commute well."
      : "Public charging is your primary source — plan sessions around your routine.";

  const watchArea =
    fitResult.stress_flags?.[0]?.label ||
    (fitResult.score_0_100 < 65 ? "Charging friction on longer days" : null);

  const inputSnapshot = {
    vehicle: vehicleSummary,
    routine,
    profile_id: profile?.id || null,
  };

  let outputPayload: Record<string, unknown>;

  if (reportType === "routine_health") {
    outputPayload = {
      vehicle: vehicleSummary,
      routine_health: {
        score: fitResult.score_0_100,
        label: fitResult.label,
        headline:
          fitResult.score_0_100 >= 65
            ? "Your current driving pattern fits this vehicle well."
            : "Some friction areas exist — review the details below.",
        watch_area: watchArea,
      },
      recalls,
      routine_fit: {
        daily_commute_fit: dailyMiles < 60 ? "comfortable" : dailyMiles < 100 ? "manageable" : "stretched",
        longest_day_buffer: fitResult.score_0_100 >= 70 ? "solid" : "tight",
        charging_note: chargingNote,
      },
      ai_chat_context: {
        vehicle_label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" "),
        routine_summary: `${routine.charging_access} charging · ~${routine.weekly_miles || 150} mi/week · ${routine.climate} climate`,
        recall_summary: recalls.length > 0 ? `${recalls.length} recall(s) on record` : "No open recalls found",
      },
    };
  } else {
    // sellers_report
    const openRecalls = recalls.length;
    const recallSummary =
      openRecalls === 0
        ? "No open recalls found."
        : `${openRecalls} recall(s) on record — verify status with dealer.`;

    outputPayload = {
      vehicle_summary: {
        ...vehicleSummary,
        range_mi: null, // VIN decode doesn't always return range; leave null if unavailable
      },
      routine_fit_highlights: [
        `~${dailyMiles} mi daily pattern — ${fitResult.score_0_100 >= 65 ? "well within" : "near the edge of"} this vehicle's range`,
        `Charging: ${chargingNote}`,
        fitResult.label === "Great Fit" || fitResult.label === "Good Fit"
          ? "Routine fit score indicates low ownership friction"
          : "Some friction areas noted in routine analysis",
      ],
      recall_snapshot: {
        open_count: openRecalls,
        resolved_count: 0,
        summary: recallSummary,
      },
      buyer_ready_answers: [
        {
          question: "Has this vehicle had any recalls?",
          answer:
            openRecalls === 0
              ? "No open recalls found via NHTSA at time of report."
              : `${openRecalls} recall(s) found via NHTSA. Verify completion status with dealer or NHTSA.gov.`,
        },
        {
          question: "What is the real-world range for this vehicle?",
          answer: vehicle.make && vehicle.model
            ? `Refer to the EPA rating for ${vehicle.year || ""} ${vehicle.make} ${vehicle.model}. Real-world range is typically 85–92% of the EPA figure.`
            : "Check the EPA label for the certified range figure.",
        },
        {
          question: "How has this vehicle been used?",
          answer: `Approximately ${routine.weekly_miles || 150} miles per week · ${routine.charging_access} charging · ${routine.climate} climate conditions.`,
        },
      ],
      verification_token: `offo-sv-${vehicleId.slice(0, 8)}`,
      generated_at: new Date().toISOString(),
    };
  }

  // 8. Upsert into owned_ev_reports
  const { data: reportRow, error: upsertError } = await supabase
    .from("owned_ev_reports")
    .upsert(
      {
        user_id: user.id,
        garage_vehicle_id: vehicleId,
        vin: vehicle.vin || "",
        report_type: reportType,
        report_version: 1,
        input_snapshot: inputSnapshot,
        output_payload: outputPayload,
        status: "completed",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,garage_vehicle_id,report_type",
        ignoreDuplicates: false,
      }
    )
    .select("*")
    .single();

  if (upsertError) {
    // If upsert fails due to missing unique constraint, fall back to insert
    const { data: insertRow, error: insertError } = await supabase
      .from("owned_ev_reports")
      .insert({
        user_id: user.id,
        garage_vehicle_id: vehicleId,
        vin: vehicle.vin || "",
        report_type: reportType,
        input_snapshot: inputSnapshot,
        output_payload: outputPayload,
        status: "completed",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    trackServerEvent({
      event_name: "owned_ev_report_generated",
      source: "garage",
      user_id: user.id,
      entity_type: "garage_vehicle_id",
      entity_id: vehicleId,
      page_path: `/api/workspace/garage/${vehicleId}/owned-ev/report`,
      payload: { report_type: reportType, fit_score: fitResult.score_0_100 },
    });

    return NextResponse.json({ success: true, report: insertRow });
  }

  trackServerEvent({
    event_name: "owned_ev_report_generated",
    source: "garage",
    user_id: user.id,
    entity_type: "garage_vehicle_id",
    entity_id: vehicleId,
    page_path: `/api/workspace/garage/${vehicleId}/owned-ev/report`,
    payload: { report_type: reportType, fit_score: fitResult.score_0_100 },
  });

  return NextResponse.json({ success: true, report: reportRow });
}
