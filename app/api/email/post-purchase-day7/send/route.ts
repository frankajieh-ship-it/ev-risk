/**
 * Post-Purchase Day 7 Email Sender (Internal)
 *
 * POST /api/email/post-purchase-day7/send
 * Protected by ADMIN_API_KEY. Called daily by send-post-purchase-day7 Netlify function.
 *
 * For each paid receipt purchase created 6–8 days ago:
 *   1. Skips if already sent (idempotency via crm_email_sends)
 *   2. Resolves the garage vehicle linked to the receipt (if any)
 *   3. Finds up to 3 similar deals from curated_deals (same make, ±3 years)
 *   4. Builds a signed confirm token (base64 of userId:garageVehicleId)
 *   5. Sends Day 7 check-in email via safeSend()
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { isResendConfigured } from "@/lib/resend";
import { safeSend } from "@/lib/crm-email";
import { buildPostPurchaseDay7Email } from "@/lib/crm-templates/post-purchase-day7";

const BATCH_LIMIT = 100;
const MIN_AGE_DAYS = 6;
const MAX_AGE_DAYS = 8;

function buildConfirmToken(userId: string, garageVehicleId: string | null): string {
  return Buffer.from(JSON.stringify({ userId, garageVehicleId })).toString("base64url");
}

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
  const minDate = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const maxDate = new Date(now.getTime() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results = { checked: 0, sent: 0, skipped: 0, errors: 0 };

  const { data: purchases, error: fetchErr } = await supabase
    .from("purchases")
    .select("purchase_id, user_id, base_scenario_id, scenario_type, pack_tier")
    .eq("status", "paid")
    .in("pack_tier", ["receipt_single", "buyer_pass", "decision_pack"])
    .eq("scenario_type", "receipt")
    .not("user_id", "is", null)
    .gte("created_at", minDate)
    .lte("created_at", maxDate)
    .limit(BATCH_LIMIT);

  if (fetchErr || !purchases) {
    return NextResponse.json({ error: fetchErr?.message ?? "No purchases" }, { status: 500 });
  }

  for (const purchase of purchases) {
    results.checked++;
    try {
      const idempotencyKey = `post-purchase-day7:${purchase.purchase_id}`;

      // Skip if already sent
      const { data: existing } = await supabase
        .from("crm_email_sends")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        results.skipped++;
        continue;
      }

      // Get user email
      const { data: { user } } = await supabase.auth.admin.getUserById(purchase.user_id as string);
      const email = user?.email;
      if (!email) {
        results.skipped++;
        continue;
      }

      // Resolve receipt data (vehicle label + share slug)
      const { data: receipt } = await supabase
        .from("receipts")
        .select("id, output_json")
        .eq("id", purchase.base_scenario_id)
        .maybeSingle();

      const output = receipt?.output_json as Record<string, unknown> | null;
      const year = output?.year;
      const make = output?.make as string | undefined;
      const model = output?.model as string | undefined;
      const vehicleLabel = [year, make, model].filter(Boolean).join(" ") || "your vehicle";

      // Get share slug for "still looking" CTA
      const { data: shared } = await supabase
        .from("shared_receipts")
        .select("share_slug")
        .eq("receipt_id", purchase.base_scenario_id)
        .maybeSingle();
      const receiptSlug = shared?.share_slug ?? "";

      // Find linked garage vehicle
      const { data: garageVehicle } = await supabase
        .from("garage_vehicles")
        .select("id, is_owned_ev")
        .eq("receipt_id", purchase.base_scenario_id)
        .eq("user_id", purchase.user_id)
        .maybeSingle();

      // Skip if user already marked vehicle as owned
      if (garageVehicle?.is_owned_ev) {
        results.skipped++;
        continue;
      }

      const garageVehicleId = garageVehicle?.id ?? null;

      // Find up to 3 similar deals (same make, ±3 years)
      const vehicleYear = typeof year === "number" ? year : null;
      const { data: similar } = make
        ? await supabase
            .from("curated_deals")
            .select("make, model, year, price_cents, listing_url")
            .eq("make", make)
            .not("listing_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(30)
        : { data: [] };

      const similarDeals = (similar ?? [])
        .filter((d) => {
          if (vehicleYear && d.year) return Math.abs(d.year - vehicleYear) <= 3;
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

      const confirmToken = buildConfirmToken(purchase.user_id as string, garageVehicleId);

      const { subject, html } = buildPostPurchaseDay7Email({
        email,
        userId: purchase.user_id as string,
        vehicleLabel,
        receiptSlug,
        garageVehicleId,
        confirmToken,
        similarDeals,
      });

      const r = await safeSend({
        email,
        userId: purchase.user_id as string,
        sequenceType: "post_purchase_day7",
        sequenceStep: "day7_check_in",
        subject,
        html,
        idempotencyKey,
        metadata: {
          purchase_id: purchase.purchase_id,
          receipt_id: purchase.base_scenario_id,
          garage_vehicle_id: garageVehicleId,
        },
      });

      if (r.sent) results.sent++;
      else if (r.skipped) results.skipped++;
      else results.errors++;
    } catch (err) {
      console.error("[post-purchase-day7] Error for purchase", purchase.purchase_id, err instanceof Error ? err.message : err);
      results.errors++;
    }
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), ...results });
}
