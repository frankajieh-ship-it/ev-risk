/**
 * GET /api/admin/vin-history-test?vin=XXX&key=ADMIN_API_KEY
 *
 * Hits all three VIN history providers with a raw call and returns
 * the full response from each. Used to verify credentials and inspect
 * response shapes before finalizing mappers. Local dev only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVinHistory } from "@/lib/vin-history-client";

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

  const [vinaudit, carsxe, vehicledb] = await Promise.all([
    // VinAudit Lite Check
    (async () => {
      const k = process.env.VINAUDIT_KEY;
      const u = process.env.VINAUDIT_USER;
      const p = process.env.VINAUDIT_PASS;
      if (!k || !u || !p) return { configured: false };
      const url = `https://api.vinaudit.com/v2/pullreport?format=json&key=${k}&user=${encodeURIComponent(u)}&pass=${encodeURIComponent(p)}&mode=lite&vin=${vin}`;
      return { configured: true, ...(await fetchWithTimeout(url, {}, 12000)) };
    })(),

    // CarsXE Vehicle History
    (async () => {
      const k = process.env.Cars_XE;
      if (!k) return { configured: false };
      const url = `https://api.carsxe.com/history?key=${k}&vin=${vin}`;
      return { configured: true, ...(await fetchWithTimeout(url, {}, 12000)) };
    })(),

    // VehicleDatabases Vehicle History — try both auth styles
    (async () => {
      const k = process.env.Vehicle_database;
      if (!k) return { configured: false };
      // Try query param style first
      const url = `https://api.vehicledatabases.com/vehicle-history/${vin}?x-api-key=${k}`;
      const r1 = await fetchWithTimeout(url, {}, 12000);
      if (r1.ok) return { configured: true, auth_style: "query_param", ...r1 };
      // Fall back to header style
      const url2 = `https://api.vehicledatabases.com/vehicle-history/${vin}`;
      const r2 = await fetchWithTimeout(url2, { headers: { "x-api-key": k, "Ocp-Apim-Subscription-Key": k } }, 12000);
      return { configured: true, auth_style: "header", ...r2 };
    })(),
  ]);

  // Also run the normalized waterfall so we can see the mapped output
  const normalized = await getVinHistory(vin).catch((e) => ({ success: false as const, error: String(e), providers_attempted: [] }));

  return NextResponse.json({
    vin,
    normalized,
    providers: { vinaudit, carsxe, vehicledb },
  });
}
