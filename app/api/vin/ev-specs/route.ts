/**
 * GET /api/vin/ev-specs?year=&make=&model=&trim=
 *
 * Returns EV powertrain specs (battery capacity, range, charging times) from
 * VehicleDatabases.com for the given YMM+trim combination.
 */

import { NextResponse } from "next/server";
import { evSpecs } from "@/lib/vehicledatabases-client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const make = searchParams.get("make") ?? "";
  const model = searchParams.get("model") ?? "";
  const trim = searchParams.get("trim") ?? "";

  if (!year || !make || !model) {
    return NextResponse.json({ success: false, error: "year, make, and model are required" }, { status: 400 });
  }

  const result = await evSpecs(year, make, model, trim);

  if (!result.success) {
    const status = result.code === "not_configured" ? 503 : result.code === "not_found" ? 404 : 502;
    return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
  }

  return NextResponse.json(result);
}
