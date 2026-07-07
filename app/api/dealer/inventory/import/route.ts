/**
 * POST /api/dealer/inventory/import
 *
 * Bulk CSV import for dealer inventory. Accepts multipart/form-data with a
 * single "file" field containing a UTF-8 CSV. Parses rows, validates required
 * fields, and inserts valid rows to dealer_inventory.
 *
 * CSV columns (case-insensitive headers):
 *   VIN, Make*, Model*, Year, Trim, Price, Mileage, Color, Status, ListingURL
 *   (* required)
 *
 * Returns: { inserted, failed: [{ row, reason }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import { classifyVehicle } from "@/lib/vehicle-classifier";

const MAX_ROWS = 500;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim());
  const headers = rawHeaders.map(normalizeHeader);

  return lines.slice(1).map((line) => {
    // Simple CSV parse — handles quoted fields
    const values: string[] = [];
    let inQuote = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

const VALID_STATUSES = new Set(["active", "pending", "sold", "inactive"]);

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  // CSV import is a Growth/Pro feature
  const supabaseCheck = getSupabaseAdmin()!;
  const { data: dealership } = await supabaseCheck
    .from("dealerships")
    .select("subscription_tier, subscription_status")
    .eq("id", dealershipId)
    .maybeSingle();

  const tier = dealership?.subscription_tier;
  const subStatus = dealership?.subscription_status;
  if ((tier !== "growth" && tier !== "pro") || subStatus !== "active") {
    return NextResponse.json(
      { success: false, error: "CSV import requires an active Growth or Pro subscription." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json({ success: false, error: "File must be a .csv" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "File exceeds 2MB limit" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "CSV has no data rows" }, { status: 400 });
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { success: false, error: `CSV exceeds ${MAX_ROWS} row limit (got ${rows.length})` },
      { status: 400 }
    );
  }

  const supabase = supabaseCheck;
  const inserted: string[] = [];
  const failed: Array<{ row: number; reason: string }> = [];

  // Process rows sequentially to avoid hammering DB with 500 parallel inserts
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // +2 = 1-based + header row

    const make = r["make"]?.trim();
    const model = r["model"]?.trim();

    if (!make) { failed.push({ row: rowNum, reason: "Missing Make" }); continue; }
    if (!model) { failed.push({ row: rowNum, reason: "Missing Model" }); continue; }

    const rawYear = r["year"]?.trim();
    const year = rawYear ? parseInt(rawYear, 10) : null;
    if (rawYear && (isNaN(year!) || year! < 1900 || year! > 2100)) {
      failed.push({ row: rowNum, reason: `Invalid year: "${rawYear}"` }); continue;
    }

    const rawPrice = r["price"]?.replace(/[$,]/g, "").trim();
    const price = rawPrice ? parseFloat(rawPrice) : null;
    if (rawPrice && (isNaN(price!) || price! < 0)) {
      failed.push({ row: rowNum, reason: `Invalid price: "${rawPrice}"` }); continue;
    }

    const rawMileage = r["mileage"]?.replace(/,/g, "").trim();
    const mileage = rawMileage ? parseInt(rawMileage, 10) : null;
    if (rawMileage && (isNaN(mileage!) || mileage! < 0)) {
      failed.push({ row: rowNum, reason: `Invalid mileage: "${rawMileage}"` }); continue;
    }

    const rawVin = r["vin"]?.trim().toUpperCase() || null;
    if (rawVin && rawVin.length !== 17) {
      failed.push({ row: rowNum, reason: `VIN must be 17 characters (got ${rawVin.length})` }); continue;
    }

    const rawStatus = r["status"]?.trim().toLowerCase();
    const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : "active";

    const listingUrl = r["listingurl"]?.trim() || null;
    const trim = r["trim"]?.trim() || null;
    const exteriorColor = r["color"]?.trim() || null;
    const classification = classifyVehicle(make, model, trim ?? undefined);

    const { data, error } = await supabase
      .from("dealer_inventory")
      .insert({
        dealership_id: dealershipId,
        make,
        model,
        year: year ?? null,
        trim,
        vin: rawVin,
        price_cents: price != null ? Math.round(price * 100) : null,
        mileage: mileage ?? null,
        exterior_color: exteriorColor,
        status,
        listing_url: listingUrl,
        classification,
      })
      .select("id")
      .single();

    if (error) {
      const reason = error.code === "23505"
        ? "Duplicate VIN — already in inventory"
        : error.message;
      failed.push({ row: rowNum, reason });
    } else {
      inserted.push(data.id);
    }
  }

  return NextResponse.json({
    success: true,
    inserted: inserted.length,
    failed,
  });
}
