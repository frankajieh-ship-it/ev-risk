import { NextRequest, NextResponse } from "next/server";
import { extractVehicleData } from "@/lib/listing-scraper";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

export const maxDuration = 45;

export async function POST(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { url } = body as { url?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const result = await extractVehicleData(url, { adminKey: ADMIN_KEY });

  return NextResponse.json({
    success: result.success,
    fields: result.data
      ? {
          year: result.data.year,
          make: result.data.make,
          model: result.data.model,
          trim: result.data.trim,
          mileage: result.data.mileage,
          price: result.data.price,
          vin: result.data.vin,
          title_status: result.data.title_status,
          accidents_reported: result.data.accidents_reported,
        }
      : null,
    error: result.error ?? null,
    diagnostics: result.diagnostics ?? null,
    warnings: result.warnings ?? [],
  });
}
