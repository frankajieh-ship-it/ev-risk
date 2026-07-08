/**
 * GET /api/admin/vin-history-test?vin=XXX&key=ADMIN_API_KEY
 *
 * Hits VehicleDatabases with a raw call and returns the full response.
 * Used to verify credentials and inspect response shapes. Local dev only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVinHistory } from "@/lib/vin-history-client";
import { titleCheck, auctionHistory } from "@/lib/vehicledatabases-client";

export const maxDuration = 30;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<{ ok: boolean; status: number; body: unknown }> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    let body: unknown;
    const ct = res.headers.get("content-type") ?? "";
    try {
      body = ct.includes("application/json") ? await res.json() : await res.text();
    } catch {
      body = "(could not parse response body)";
    }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(request: NextRequest) {
  const adminKey = process.env.ADMIN_API_KEY;
  const key = request.nextUrl.searchParams.get("key");
  if (adminKey && key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vin = request.nextUrl.searchParams.get("vin")?.trim().toUpperCase();
  if (!vin || vin.length !== 17) {
    return NextResponse.json({ error: "Provide a 17-character VIN via ?vin=" }, { status: 400 });
  }

  const vdKey = process.env.VEHICLEDATABASES_API_KEY;

  const [vehicleHistory, titleRaw, auctionRaw, normalized] = await Promise.all([
    // VehicleDatabases /vehicle-history (full — may be 401 on current plan)
    vdKey
      ? fetchWithTimeout(`https://api.vehicledatabases.com/vehicle-history/${vin}`, { headers: { "x-authkey": vdKey } }, 15000)
      : Promise.resolve({ configured: false, ok: false, status: 0, body: null }),

    // VehicleDatabases /title-check (active on current plan)
    titleCheck(vin),

    // VehicleDatabases /auction (active on current plan)
    auctionHistory(vin),

    // Normalized waterfall result
    getVinHistory(vin).catch((e) => ({ success: false as const, error: String(e), providers_attempted: [] })),
  ]);

  return NextResponse.json({
    vin,
    normalized,
    raw: {
      vehicle_history: vehicleHistory,
      title_check: titleRaw,
      auction: auctionRaw,
    },
  });
}
