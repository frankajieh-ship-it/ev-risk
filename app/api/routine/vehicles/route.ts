/**
 * Vehicle Profiles API
 * GET /api/routine/vehicles — List active vehicle profiles
 *
 * Returns curated EV presets for the vehicle selector dropdown.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: true, vehicles: [] }
    );
  }

  try {
    const { data, error } = await supabase
      .from("vehicle_profiles")
      .select("*")
      .eq("is_active", true)
      .order("year", { ascending: false })
      .order("make", { ascending: true })
      .order("model", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      vehicles: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
