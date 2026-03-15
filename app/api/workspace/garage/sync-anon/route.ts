/**
 * POST /api/workspace/garage/sync-anon
 *
 * Called immediately after login to sync anonymous garage items to the
 * user's server-side account. Maps:
 *   type="shortlist"    → garage_vehicles insert
 *   type="receipt"      → saved_scenarios insert (receipt type)
 *   type="fit_profile"  → saved_scenarios insert (evroutine type)
 *
 * Idempotent — duplicate labels per user are skipped.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { classifyVehicle } from "@/lib/vehicle-classifier";
import type { AnonGarageItem } from "@/lib/anon-garage";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  let items: AnonGarageItem[];
  try {
    const body = await req.json();
    items = Array.isArray(body.items) ? body.items : [];
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json({ success: true, synced: 0, skipped: 0 });
  }

  let synced = 0;
  let skipped = 0;

  for (const item of items) {
    try {
      if (item.type === "shortlist") {
        // Extract vehicle fields from the ShortlistCandidate data
        const data = item.data as Record<string, unknown>;
        const label = item.label || "Unknown Vehicle";
        // Parse "2023 Chevy Bolt EV" style labels
        const parts = label.trim().split(" ");
        const year = parts[0] ? parseInt(parts[0], 10) : null;
        const make = parts[1] || null;
        const model = parts.slice(2).join(" ") || null;

        if (!make || !model) { skipped++; continue; }

        const classification = classifyVehicle(make, model, undefined);

        const { error } = await supabase.from("garage_vehicles").insert({
          user_id: user.id,
          make,
          model,
          year: isNaN(year ?? NaN) ? null : year,
          nickname: null,
          classification,
          notes: `Synced from anonymous garage on ${new Date().toLocaleDateString()}`,
          // Store original candidate data in notes won't fit — just save essentials
        });

        if (error) {
          // Duplicate or constraint violation — skip silently
          skipped++;
        } else {
          synced++;
        }

      } else if (item.type === "receipt") {
        const data = item.data as Record<string, unknown>;
        const receiptId = (data.receipt_id as string) || null;
        const vehicle = item.label || "Unknown Vehicle";
        const parts = vehicle.trim().split(" ");
        const year = parts[0] ? parseInt(parts[0], 10) : null;
        const vehicleModel = parts.slice(1).join(" ") || vehicle;
        const hash = `anon-sync-receipt-${receiptId || item.id}`;

        // Check for existing scenario with same hash
        const { data: existing } = await supabase
          .from("saved_scenarios")
          .select("id")
          .eq("user_id", user.id)
          .eq("scenario_hash", hash)
          .single();

        if (existing) { skipped++; continue; }

        const { error } = await supabase.from("saved_scenarios").insert({
          user_id: user.id,
          receipt_id: receiptId,
          scenario_type: "receipt",
          scenario_hash: hash,
          vehicle_model: vehicleModel,
          vehicle_year: !isNaN(year ?? NaN) && year ? year : 0,
          fit_signal: (data.verdict as string) || null,
          one_sentence_verdict: (data.verdict_reason as string) || null,
          inputs: data,
          is_comparison: false,
        });

        if (error) { skipped++; } else { synced++; }

      } else if (item.type === "fit_profile") {
        const data = item.data as Record<string, unknown>;
        const hash = `anon-sync-fit-${item.id}`;

        const { data: existing } = await supabase
          .from("saved_scenarios")
          .select("id")
          .eq("user_id", user.id)
          .eq("scenario_hash", hash)
          .single();

        if (existing) { skipped++; continue; }

        const { error } = await supabase.from("saved_scenarios").insert({
          user_id: user.id,
          scenario_type: "evroutine",
          scenario_hash: hash,
          vehicle_model: item.label || "Fit Profile",
          vehicle_year: 0,
          inputs: data,
          is_comparison: false,
        });

        if (error) { skipped++; } else { synced++; }
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ success: true, synced, skipped });
}
