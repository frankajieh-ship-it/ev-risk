/**
 * Garage Price Drop Alert Sender (Internal)
 *
 * POST /api/email/garage-price-drop/send
 * Protected by ADMIN_API_KEY. Called daily by scan-garage-prices Netlify function.
 *
 * For each garage vehicle with a listing_url and listing_price_at_save:
 *   1. Queries receipts for the most recent last_price_cents on that listing URL
 *   2. If price dropped > 3% since save, sends a price drop alert email
 *   3. Updates price_drop_cents and price_last_checked_at on garage_vehicles
 *
 * Uses safeSend() idempotency: key is price-drop:{vehicleId}:{currentPriceCents}
 * so the same drop never fires twice, but a further drop will fire again.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildGaragePriceDropEmail } from "@/lib/crm-templates/deal-watch";

const BATCH_LIMIT = 100;
const DROP_THRESHOLD_BPS = 300; // 3%

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!isResendConfigured()) return NextResponse.json({ error: "Email service not configured" }, { status: 503 });

  const now = new Date();
  const results = { checked: 0, dropped: 0, alerted: 0, skipped: 0, errors: 0 };

  // Fetch garage vehicles that have a URL + saved price and are not owned EVs
  const { data: vehicles, error: fetchErr } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year, listing_url, listing_price_at_save, price_drop_cents")
    .not("listing_url", "is", null)
    .not("listing_price_at_save", "is", null)
    .eq("is_owned_ev", false)
    .limit(BATCH_LIMIT);

  if (fetchErr || !vehicles) {
    return NextResponse.json({ error: fetchErr?.message ?? "No vehicles" }, { status: 500 });
  }

  for (const vehicle of vehicles) {
    results.checked++;
    try {
      // Find most recent receipt for this listing URL with a price
      const { data: receipt } = await supabase
        .from("receipts")
        .select("last_price_cents, output_json")
        .eq("listing_url", vehicle.listing_url)
        .not("last_price_cents", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fall back to output_json.listing_summary.price if last_price_cents is not populated
      let currentPriceCents: number | null = receipt?.last_price_cents ?? null;
      if (!currentPriceCents && receipt?.output_json) {
        const summary = (receipt.output_json as Record<string, unknown>)?.listing_summary as Record<string, unknown> | undefined;
        currentPriceCents = summary?.price ? Math.round(Number(summary.price) * 100) : null;
      }

      if (!currentPriceCents) {
        results.skipped++;
        continue;
      }

      const savedPrice = vehicle.listing_price_at_save as number;
      const dropCents = savedPrice - currentPriceCents;
      const dropBps = Math.round((dropCents / savedPrice) * 10000);

      // Update last checked regardless
      await supabase
        .from("garage_vehicles")
        .update({
          price_last_checked_at: now.toISOString(),
          price_drop_cents: dropCents > 0 ? dropCents : null,
        })
        .eq("id", vehicle.id);

      if (dropBps < DROP_THRESHOLD_BPS || dropCents <= 0) {
        results.skipped++;
        continue;
      }

      results.dropped++;

      // Get user email
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("user_id", vehicle.user_id)
        .maybeSingle();

      const email = profile?.email;
      if (!email) {
        results.skipped++;
        continue;
      }

      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "your saved vehicle";

      const { subject, html } = buildGaragePriceDropEmail({
        email,
        vehicle: vehicleLabel,
        savedPriceCents: savedPrice,
        currentPriceCents,
        dropCents,
        listingUrl: vehicle.listing_url as string,
        garageVehicleId: vehicle.id as string,
      });

      const r = await safeSend({
        email,
        sequenceType: "deal_watch",
        sequenceStep: "price_drop",
        subject,
        html,
        idempotencyKey: `price-drop:${vehicle.id}:${currentPriceCents}`,
        metadata: {
          garage_vehicle_id: vehicle.id,
          saved_price_cents: savedPrice,
          current_price_cents: currentPriceCents,
          drop_cents: dropCents,
        },
      });

      if (r.sent) results.alerted++;
      else if (r.skipped) results.skipped++;
      else results.errors++;
    } catch (err) {
      console.error("[garage-price-drop] Error for vehicle", vehicle.id, err instanceof Error ? err.message : err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), ...results });
}
