/**
 * GET /api/tools/warranty
 * Query: ?make=Tesla&model=Model+Y&year=2021&mileage=45000
 * Returns warranty status for the specified vehicle.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeWarrantyResult } from "@/lib/warranty-data";
import { getTraits } from "@/lib/specs-scorer";

const CURRENT_YEAR = new Date().getFullYear();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const make    = searchParams.get("make")?.trim() ?? "";
  const model   = searchParams.get("model")?.trim() ?? "";
  const yearStr = searchParams.get("year") ?? "";
  const mileStr = searchParams.get("mileage") ?? "";

  if (!make || !model || !yearStr || !mileStr) {
    return NextResponse.json(
      { success: false, error: "make, model, year, and mileage are required" },
      { status: 400 }
    );
  }

  const year = parseInt(yearStr, 10);
  const mileage = parseInt(mileStr, 10);

  if (isNaN(year) || year < 2008 || year > CURRENT_YEAR + 1) {
    return NextResponse.json(
      { success: false, error: "Invalid year" },
      { status: 400 }
    );
  }

  if (isNaN(mileage) || mileage < 0 || mileage > 500_000) {
    return NextResponse.json(
      { success: false, error: "Invalid mileage" },
      { status: 400 }
    );
  }

  // Look up battery_kwh from traits table if available
  const vehicleLabel = `${make} ${model} ${year}`;
  const traits = getTraits(vehicleLabel);
  const battery_kwh = traits.battery_kwh ?? undefined;

  const result = computeWarrantyResult(make, model, year, mileage, CURRENT_YEAR, battery_kwh);

  return NextResponse.json({ success: true, result });
}
