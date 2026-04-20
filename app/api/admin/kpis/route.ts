/**
 * Daily KPI Endpoint
 *
 * GET /api/admin/kpis?date=YYYY-MM-DD
 * Returns daily event counts from user_events table.
 * Protected by ADMIN_API_KEY bearer token.
 * Defaults to today in ET (America/Indiana/Indianapolis).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const ADMIN_KEY = process.env.ADMIN_API_KEY;
const TIMEZONE = "America/Indiana/Indianapolis";

/**
 * Convert a YYYY-MM-DD date string in ET to UTC start/end boundaries.
 * Uses Intl.DateTimeFormat for DST-aware conversion.
 */
function getUTCBoundaries(dateStr: string): { start: string; end: string } {
  // Create date at midnight ET by finding the UTC offset for that date
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1] - 1; // 0-indexed
  const day = parts[2];

  // Create a date object at noon in UTC to avoid DST edge cases during offset detection
  const probe = new Date(Date.UTC(year, month, day, 12, 0, 0));

  // Get the ET representation of this probe date to determine offset
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const etParts = formatter.formatToParts(probe);
  const etHour = Number(etParts.find((p) => p.type === "hour")?.value || "12");

  // offset = UTC hour that corresponds to ET hour at the probe time
  // probe is at 12:00 UTC, ET shows etHour → offset in hours = 12 - etHour
  const offsetHours = 12 - etHour;

  // Midnight ET = offsetHours in UTC
  const startUTC = new Date(Date.UTC(year, month, day, offsetHours, 0, 0));
  const endUTC = new Date(
    Date.UTC(year, month, day + 1, offsetHours, 0, 0)
  );

  return {
    start: startUTC.toISOString(),
    end: endUTC.toISOString(),
  };
}

/**
 * Get today's date string in ET timezone.
 */
function getTodayET(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // Returns YYYY-MM-DD
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Auth check
  const authHeader = request.headers.get("authorization");
  const providedKey = authHeader?.replace("Bearer ", "");

  if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || getTodayET();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const { start, end } = getUTCBoundaries(date);

    // Query user_events for the date range
    const { data: events, error } = await supabase
      .from("user_events")
      .select("event_name, event_data")
      .gte("timestamp", start)
      .lt("timestamp", end);

    if (error) {
      console.error("KPI query error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to query events" },
        { status: 500 }
      );
    }

    const allEvents = events || [];

    // Count by event name
    const counts: Record<string, number> = {};
    for (const e of allEvents) {
      counts[e.event_name] = (counts[e.event_name] || 0) + 1;
    }

    // Top vehicles from evfit_completed events — tally #1 picks
    const vehicleTally: Record<string, number> = {};
    for (const e of allEvents) {
      if (e.event_name !== "evfit_completed") continue;
      const top = (e.event_data as Record<string, unknown> | null)?.top_vehicles as Array<{
        make: string; model: string; fit_score: number;
      }> | undefined;
      const pick = top?.[0];
      if (pick?.make && pick?.model) {
        const key = `${pick.make} ${pick.model}`;
        vehicleTally[key] = (vehicleTally[key] || 0) + 1;
      }
    }
    const top_vehicles_picked = Object.entries(vehicleTally)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([vehicle, count]) => ({ vehicle, count }));

    // All-time profiles saved (not date-scoped — cumulative count)
    const { count: profilesSavedTotal } = await supabase
      .from("user_events")
      .select("*", { count: "exact", head: true })
      .in("event_name", ["profile_saved", "routine_saved"]);

    return NextResponse.json({
      success: true,
      date,
      timezone: TIMEZONE,
      kpis: {
        free_receipts_completed: counts["receipt_generate"] || 0,
        copy_reddit_draft: counts["copy_reddit_draft"] || 0,
        copy_seller_message: counts["copy_seller_message"] || 0,
        copy_checklist: counts["copy_checklist"] || 0,
        saves: counts["scenario_save_success"] || 0,
        evfit_completed: counts["evfit_completed"] || 0,
        profiles_saved_today: (counts["profile_saved"] || 0) + (counts["routine_saved"] || 0),
        profiles_saved_total: profilesSavedTotal ?? 0,
      },
      top_vehicles_picked,
    });
  } catch (err) {
    console.error("KPI endpoint error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
