/**
 * Garage Listing-Gone Alert Sender (Internal)
 *
 * POST /api/email/garage-listing-gone/send
 * Protected by ADMIN_API_KEY. Called daily by scan-garage-listings Netlify function.
 *
 * For each unsaved garage vehicle with a listing_url not already marked gone:
 *   1. Checks receipts table — if no active receipt exists for the URL, listing is gone
 *   2. Guards: vehicle must be saved >3 days ago to avoid false positives on fresh saves
 *   3. Finds up to 3 similar EVs from curated_deals (same make, ±2 years)
 *   4. Sends listing-gone alert via safeSend()
 *   5. Marks listing_is_gone = true on garage_vehicles
 *
 * Uses safeSend() idempotency: key is listing-gone:{vehicleId}
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildGarageListingGoneEmail } from "@/lib/crm-templates/garage-listing-gone";

const BATCH_LIMIT = 100;
const MIN_AGE_DAYS = 3;

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
  const minAgeDate = new Date(now.getTime() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results = { checked: 0, gone: 0, alerted: 0, skipped: 0, errors: 0 };

  const { data: vehicles, error: fetchErr } = await supabase
    .from("garage_vehicles")
    .select("id, user_id, make, model, year, listing_url, created_at")
    .not("listing_url", "is", null)
    .eq("is_owned_ev", false)
    .eq("listing_is_gone", false)
    .lt("created_at", minAgeDate)
    .limit(BATCH_LIMIT);

  if (fetchErr || !vehicles) {
    return NextResponse.json({ error: fetchErr?.message ?? "No vehicles" }, { status: 500 });
  }

  for (const vehicle of vehicles) {
    results.checked++;
    try {
      // Check if any active receipt still exists for this listing URL
      const { data: activeReceipt } = await supabase
        .from("receipts")
        .select("receipt_id")
        .eq("listing_url", vehicle.listing_url)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (activeReceipt) {
        results.skipped++;
        continue;
      }

      // Confirm at least one receipt exists (vs just never been checked)
      const { data: anyReceipt } = await supabase
        .from("receipts")
        .select("receipt_id")
        .eq("listing_url", vehicle.listing_url)
        .limit(1)
        .maybeSingle();

      if (!anyReceipt) {
        results.skipped++;
        continue;
      }

      results.gone++;

      // Mark gone immediately (before email) to avoid re-processing on retry
      await supabase
        .from("garage_vehicles")
        .update({ listing_is_gone: true, listing_gone_detected_at: now.toISOString() })
        .eq("id", vehicle.id);

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

      // Find up to 3 similar EVs (same make, ±2 years)
      const vehicleYear = typeof vehicle.year === "number" ? vehicle.year : null;
      const { data: similar } = await supabase
        .from("curated_deals")
        .select("make, model, year, price_cents, listing_url")
        .eq("make", vehicle.make)
        .not("listing_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const similarVehicles = (similar ?? [])
        .filter((d) => {
          if (d.listing_url === vehicle.listing_url) return false;
          if (vehicleYear && d.year) return Math.abs(d.year - vehicleYear) <= 2;
          return true;
        })
        .slice(0, 3)
        .map((d) => ({
          make: d.make as string,
          model: d.model as string,
          year: d.year as number | null,
          priceCents: d.price_cents as number | null,
          listingUrl: d.listing_url as string | null,
        }));

      const vehicleLabel = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "your saved vehicle";

      const { subject, html } = buildGarageListingGoneEmail({
        email,
        vehicle: vehicleLabel,
        listingUrl: vehicle.listing_url as string,
        garageVehicleId: vehicle.id as string,
        similarVehicles,
      });

      const r = await safeSend({
        email,
        sequenceType: "listing_gone",
        sequenceStep: "listing_removed",
        subject,
        html,
        idempotencyKey: `listing-gone:${vehicle.id}`,
        metadata: {
          garage_vehicle_id: vehicle.id,
          listing_url: vehicle.listing_url,
          similar_count: similarVehicles.length,
        },
      });

      if (r.sent) {
        results.alerted++;
        await supabase
          .from("garage_vehicles")
          .update({ listing_gone_alert_sent_at: now.toISOString() })
          .eq("id", vehicle.id);
      } else if (r.skipped) {
        results.skipped++;
      } else {
        results.errors++;
      }
    } catch (err) {
      console.error("[garage-listing-gone] Error for vehicle", vehicle.id, err instanceof Error ? err.message : err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), ...results });
}
