/**
 * GET /api/admin/deals-debug
 *
 * Internal-only endpoint — returns all curated_deals rows with full
 * scoring fields for the admin debug table at /admin/deals.
 *
 * Protected by ADMIN_API_KEY or localhost origin (no auth required locally).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export async function GET(request: NextRequest) {
  // Allow unauthenticated access from localhost
  const host = request.headers.get("host") ?? "";
  const isLocalhost = host.startsWith("localhost:") || host === "localhost";

  if (!isLocalhost) {
    const auth = request.headers.get("authorization");
    const token = auth?.replace("Bearer ", "").trim();
    if (!ADMIN_KEY || token !== ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("curated_deals")
    .select(
      "id, listing_url, url_domain, vehicle_label, year, make, model, trim, price, mileage, location, vin, title_status, battery_report, service_records, vin_audit_summary, extracted_signals, receipt_id, last_analyzed_at, is_active, sold_report_count, created_at, verdict, photo_url, dealership_id, dcfc_kw_max, ac_charger_kw, charge_port_type, epa_range_mi, estimated_real_range_mi, seller_type, days_on_market, exterior_color, heated_seats, heat_pump, tow_hitch, climate_zone, warranty_remaining_months, supercharger_access, ota_capable, drivetrain, interior_color, doors, front_legroom_in, rear_legroom_in, cargo_volume_cuft, charge_time_notes, additional_notes"
    )
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error("[/api/admin/deals-debug] Query error:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  // Enrich photo_url the same way /api/deals does — vehicle-images.csv first,
  // then DB fallback if it's already a local path, reject external URLs.
  const deals = (data ?? []).map((d) => {
    let photoUrl: string | null = d.photo_url ?? null;
    if (d.make && d.model) {
      const local = lookupLocalImages(d.make, d.model, d.year ?? undefined);
      if (local.matched && local.urls.length > 0) {
        const url = local.urls[0];
        photoUrl = url.includes("upload.wikimedia.org")
          ? `/api/img?url=${encodeURIComponent(url)}`
          : url;
      } else if (photoUrl && photoUrl.startsWith("/")) {
        // keep as-is
      } else {
        photoUrl = null;
      }
    }
    return { ...d, photo_url: photoUrl };
  });

  return NextResponse.json({ deals });
}
