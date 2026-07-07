/**
 * POST /api/admin/dealer-prospects/import
 *
 * Accepts a CSV file (multipart/form-data, field "file") containing dealer
 * contact info gathered from CarGurus, Cars.com, AutoTrader, or the dealer's
 * own site. Upserts each row into dealerships with status='prospect', then
 * links matching curated_deals rows to that dealership by domain or URL.
 *
 * Protected by ADMIN_API_KEY bearer token.
 *
 * CSV columns (header row required, any order):
 *   dealer_name         — required
 *   contact_email       — required
 *   contact_name        — optional (sales manager / GM name)
 *   phone               — optional
 *   website             — optional (e.g. https://acmemotors.com)
 *   address_line1       — optional
 *   city                — optional
 *   state               — optional (2-letter)
 *   zip                 — optional
 *   listing_domain      — optional (e.g. cargurus.com) — used to link curated_deals
 *   listing_url_prefix  — optional (e.g. https://www.cargurus.com/Cars/dealerview/...) — more specific match
 *   source              — optional (cargurus | carscom | autotrader | manual)
 *   notes               — optional
 *
 * Slug is auto-derived from dealer_name + city + state.
 * On conflict (same contact_email or same slug): updates contact info, keeps status='prospect'
 * unless already 'approved' (existing dealers are never downgraded).
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));

  return lines.slice(1).map((line) => {
    // Handle quoted fields with commas inside
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim();
    });
    return row;
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey && authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let csvText: string;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    csvText = await file.text();
  } else {
    // Allow raw CSV body too (easier for curl)
    csvText = await request.text();
  }

  const rows = parseCSV(csvText);
  if (rows.length === 0) return NextResponse.json({ error: "CSV is empty or has no data rows" }, { status: 400 });

  const results = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
    deals_linked: 0,
  };

  for (const row of rows) {
    const dealerName = row["dealer_name"]?.trim();
    const contactEmail = row["contact_email"]?.trim().toLowerCase();

    if (!dealerName || !contactEmail) {
      results.skipped++;
      continue;
    }

    const city = row["city"]?.trim() || null;
    const state = row["state"]?.trim()?.toUpperCase() || null;
    const baseSlug = slugify(`${dealerName}${city ? `-${city}` : ""}${state ? `-${state}` : ""}`);

    try {
      // Check if a dealership with this email already exists
      const { data: existing } = await supabase
        .from("dealerships")
        .select("id, status, slug")
        .eq("contact_email", contactEmail)
        .maybeSingle();

      const shouldProtect = existing?.status === "approved" || existing?.status === "pending";

      const upsertPayload = {
        name: dealerName,
        slug: existing?.slug ?? baseSlug,
        contact_name: row["contact_name"]?.trim() || null,
        contact_email: contactEmail,
        phone: row["phone"]?.trim() || null,
        website: row["website"]?.trim() || null,
        address_line1: row["address_line1"]?.trim() || null,
        city,
        state,
        zip: row["zip"]?.trim() || null,
        prospect_source: row["source"]?.trim() || "csv_import",
        prospect_notes: row["notes"]?.trim() || null,
        // Only set status to 'prospect' if this is a new record or currently prospect
        ...(shouldProtect ? {} : { status: "prospect" }),
        updated_at: new Date().toISOString(),
      };

      let dealershipId: string;

      if (existing) {
        const { error } = await supabase
          .from("dealerships")
          .update(upsertPayload)
          .eq("id", existing.id);
        if (error) throw error;
        dealershipId = existing.id;
        results.updated++;
      } else {
        // Ensure unique slug if collision
        let slug = baseSlug;
        const { data: slugCheck } = await supabase
          .from("dealerships")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        if (slugCheck) slug = `${baseSlug}-${Date.now()}`;

        const { data: inserted, error } = await supabase
          .from("dealerships")
          .insert({ ...upsertPayload, slug })
          .select("id")
          .single();
        if (error) throw error;
        dealershipId = inserted.id;
        results.imported++;
      }

      // Link matching curated_deals rows to this dealership
      const listingDomain = row["listing_domain"]?.trim() || null;
      const listingUrlPrefix = row["listing_url_prefix"]?.trim() || null;

      if (listingDomain || listingUrlPrefix) {
        let dealQuery = supabase
          .from("curated_deals")
          .update({ dealership_id: dealershipId })
          .is("dealership_id", null); // only unlinked deals

        if (listingUrlPrefix) {
          dealQuery = dealQuery.like("listing_url", `${listingUrlPrefix}%`);
        } else if (listingDomain) {
          dealQuery = dealQuery.eq("url_domain", listingDomain);
        }

        const { count, error: linkError } = await dealQuery;
        if (!linkError && count) results.deals_linked += count;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`${dealerName} <${contactEmail}>: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    total_rows: rows.length,
    results,
  });
}
