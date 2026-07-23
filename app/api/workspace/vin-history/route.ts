/**
 * GET /api/workspace/vin-history?vin=<VIN>
 *
 * Garage-authenticated VIN history lookup. Auth is a valid session token (Bearer),
 * and the VIN must belong to a vehicle in the requesting user's garage.
 * No receipt_token paywall — garage membership is the gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getSupabaseAdmin } from "@/lib/api-auth";
import { validateVin } from "@/lib/vin-service";
import { getVinHistory } from "@/lib/vin-history-client";
import { auctionHistory } from "@/lib/vehicledatabases-client";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

export const maxDuration = 30;

const garageHistoryLimiter = new RateLimiter(10 * 60 * 1000, 10);

interface SaleRecord {
  date?: string;
  price?: string;
  odometer?: string;
  seller?: string;
  owner_type?: "dealer" | "fleet_rental" | "private" | "unknown";
}

function detectFleetPattern(records: SaleRecord[]): boolean {
  if (records.length < 2) return false;
  const dates = records
    .map((r) => (r.date ? new Date(r.date).getTime() : NaN))
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b);
  if (dates.length < 2) return false;
  let rapidPairs = 0;
  for (let i = 1; i < dates.length; i++) {
    if ((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24) < 90) rapidPairs++;
  }
  return rapidPairs >= 2;
}

function detectOdometerRollback(records: SaleRecord[]): boolean {
  const withOdo = records
    .filter((r) => r.date && r.odometer)
    .map((r) => ({ ts: new Date(r.date!).getTime(), odo: parseInt(r.odometer!, 10) }))
    .filter((r) => !isNaN(r.ts) && !isNaN(r.odo))
    .sort((a, b) => a.ts - b.ts);
  for (let i = 1; i < withOdo.length; i++) {
    if (withOdo[i].odo < withOdo[i - 1].odo - 500) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const vin = req.nextUrl.searchParams.get("vin");
  if (!vin) {
    return NextResponse.json({ success: false, error: "vin is required" }, { status: 400 });
  }

  const cleanVin = validateVin(vin);
  if (!cleanVin) {
    return NextResponse.json({ success: false, error: "Invalid VIN format" }, { status: 400 });
  }

  // Verify VIN belongs to a vehicle in the user's garage
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Database not configured" }, { status: 503 });
  }

  const { data: garageVehicle } = await supabase
    .from("garage_vehicles")
    .select("id")
    .eq("user_id", user.id)
    .eq("vin", cleanVin)
    .maybeSingle();

  if (!garageVehicle) {
    return NextResponse.json(
      { success: false, error: "VIN not found in your garage" },
      { status: 403 }
    );
  }

  const clientIP = getClientIP(req);
  const rateCheck = garageHistoryLimiter.check(`garage:${user.id}:${clientIP}`);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many history lookups. Please wait a few minutes.", resetAt: new Date(rateCheck.resetAt).toISOString() },
      { status: 429 }
    );
  }

  const [historyResult, auctionResult] = await Promise.all([
    getVinHistory(cleanVin),
    auctionHistory(cleanVin).catch(() => null),
  ]);

  if (!historyResult.success) {
    return NextResponse.json(
      { success: false, error: historyResult.error, code: "unavailable" },
      { status: 503 }
    );
  }

  const auctionSales: SaleRecord[] = (auctionResult?.success ? auctionResult.records : []).map((r) => ({
    date: r.auction_date,
    price: r.price.replace(/[^0-9.]/g, "") || undefined,
    odometer: r.odometer.replace(/[^0-9]/g, "") || undefined,
    seller: [r.location, r.title_type ? `Title: ${r.title_type}` : "", r.primary_damage ? `Damage: ${r.primary_damage}` : ""].filter(Boolean).join(" · ") || undefined,
    owner_type: "dealer" as const,
  }));

  const allSales = auctionSales;
  const possible_fleet_history = detectFleetPattern(allSales);
  const odometer_rollback = detectOdometerRollback(allSales);

  const breakdown = { dealer: 0, fleet_rental: 0, private: 0, unknown: 0 };
  for (const s of allSales) breakdown[s.owner_type ?? "unknown"]++;

  const salvageFromAuction = auctionResult?.success
    ? auctionResult.records.some((r) => r.title_type?.toLowerCase().includes("salvage"))
    : false;

  return NextResponse.json({
    success: true,
    vin: cleanVin,
    summary: {
      theft_reported: historyResult.theft_reported,
      salvage_reported: historyResult.salvage_reported || salvageFromAuction,
      accident_count: historyResult.accident_count,
      sale_count: allSales.length,
      owner_type_breakdown: breakdown,
      possible_fleet_history,
      open_lien: historyResult.open_lien ?? null,
      odometer_rollback,
    },
    theft: [],
    salvage: [],
    accidents: [],
    sales: allSales,
  });
}
