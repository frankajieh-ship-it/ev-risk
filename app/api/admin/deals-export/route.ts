/**
 * GET /api/admin/deals-export?format=csv|template
 *
 * Exports curated_deals as a CSV you can open in Excel/Google Sheets,
 * fill in manually from CarGurus, then re-import via /api/admin/deals-import.
 *
 * format=csv      — all current active deals
 * format=template — empty CSV with headers + one example row
 *
 * Protected by ADMIN_API_KEY bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

const HEADERS = [
  "listing_url",
  "vehicle_label",
  "year",
  "make",
  "model",
  "trim",
  "price",
  "mileage",
  "location",
  "verdict",
  "risk_flags",
  "photo_url",
  "url_domain",
];

function escapeCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join(";") : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvRow(row: Record<string, unknown>): string {
  return HEADERS.map((h) => escapeCell(h === "risk_flags" ? row[h] : row[h])).join(",");
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_KEY) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  if (format === "template") {
    const exampleRow = [
      "https://www.cargurus.com/details/123456789",
      "2023 Tesla Model 3 RWD",
      "2023",
      "Tesla",
      "Model 3",
      "RWD",
      "27999",
      "18500",
      "Austin, TX",
      "GREEN",
      "Battery health not disclosed;Service history incomplete",
      "",
      "cargurus.com",
    ].join(",");

    const csv = [HEADERS.join(","), exampleRow].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="deals-import-template.csv"',
      },
    });
  }

  // Export current deals
  const supabase = getSupabaseAdmin();
  if (!supabase) return new NextResponse("Service unavailable", { status: 503 });

  const { data, error } = await supabase
    .from("curated_deals")
    .select("listing_url, vehicle_label, year, make, model, trim, price, mileage, location, verdict, risk_flags, photo_url, url_domain")
    .eq("is_active", true)
    .order("deal_quality_score", { ascending: false })
    .limit(500);

  if (error) return new NextResponse("Query failed", { status: 500 });

  const rows = [HEADERS.join(","), ...(data ?? []).map((r) => buildCsvRow(r as Record<string, unknown>))];
  const csv = rows.join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="deals-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
