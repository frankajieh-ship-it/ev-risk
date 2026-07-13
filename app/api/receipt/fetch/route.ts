/**
 * OFFO Listing Receipt — URL Fetch API
 *
 * POST /api/receipt/fetch
 * Extracts vehicle data from a listing URL using the existing scraper.
 * Returns structured fields, raw_text_excerpt, and diagnostics.
 *
 * SSRF protections:
 * - HTTPS only
 * - Block IP literals and private/reserved ranges
 * - Block localhost, .local, .internal hostnames
 */

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getClientIP } from "@/lib/rate-limiter";
import { receiptBurstLimiter, extractSessionLimiter } from "@/lib/receipt-rate-limiter";
import { extractVehicleData } from "@/lib/listing-scraper";
import { extractFieldsFromText } from "@/lib/text-extractor";
import { enrichFromAutodev } from "@/lib/auto-dev-client";

import { getStaticPhotoUrl } from "@/lib/vehicle-photo";
import { lookupLocalImages } from "@/lib/vehicle-image-db";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { titleCheck } from "@/lib/vehicledatabases-client";
import type { FetchedListingFields } from "@/types/receipt";
import type { FieldConfidence } from "@/types/receipt";
import { logApi, startTimer } from "@/lib/api-logger";
import { hashIP } from "@/lib/server-session-utils";
import { isInternalTester } from "@/lib/rollout-flags";
import { getNhtsaRecalls } from "@/lib/nhtsa-recalls";

/** Extract EV-specific specs from raw listing page text using regex */
function parseEvSpecsFromText(text: string): Pick<FetchedListingFields, 'range_mi' | 'battery_kwh' | 'dc_fast_kw' | 'efficiency_mi_per_kwh'> {
  const specs: Pick<FetchedListingFields, 'range_mi' | 'battery_kwh' | 'dc_fast_kw' | 'efficiency_mi_per_kwh'> = {};

  // Range: "272 mi", "Battery range: 272 mi", "Est. range: 272 miles", "272-mile range"
  const rangeMatch = text.match(/(?:battery\s+range|est(?:imated)?\s*\.?\s*range|range)[:\s]+(\d{2,3})(?:\s*[-–]?\s*mi(?:les?)?)\b/i)
    || text.match(/\b(\d{2,3})\s*[-–]?\s*mi(?:les?)?\s+(?:range|est)/i);
  if (rangeMatch) {
    const v = parseInt(rangeMatch[1]);
    if (v >= 50 && v <= 600) specs.range_mi = v;
  }

  // Battery: "Battery capacity: 50 kWh", "75.7 kWh battery", "82kWh"
  const battMatch = text.match(/(?:battery\s+(?:capacity|size|pack))[:\s]+(\d+(?:\.\d+)?)\s*kWh/i)
    || text.match(/\b(\d+(?:\.\d+)?)\s*kWh\b/i);
  if (battMatch) {
    const v = parseFloat(battMatch[1]);
    if (v >= 20 && v <= 250) specs.battery_kwh = v;
  }

  // DC fast charge: "DC fast peak: 150 kW", "250kW DC", "Max DC charging: 150kW",
  // "DC charging: 250kW", "Fast charge rate: 250kW", "250 kW DC"
  const dcMatch = text.match(/(?:dc\s+fast(?:\s+(?:charge|charging|peak))?|max\s+dc\s+charg\w+)[:\s]+(\d+)\s*kW/i)
    || text.match(/\b(\d+)\s*kW\s+dc\b/i)
    || text.match(/dc\s+(?:charge|charging)\s*[:\-]\s*(\d+)\s*kW/i)
    || text.match(/fast\s+charg\w*\s*(?:rate\s*)?[:\-]\s*(\d+)\s*kW/i)
    || text.match(/charg\w*\s+rate\s*[:\-]\s*(\d+)\s*kW/i)
    || text.match(/\b(\d+)\s*kW\s+(?:dc|fast\s+charg)/i);
  if (dcMatch) {
    const v = parseInt(dcMatch[1]);
    if (v >= 20 && v <= 400) specs.dc_fast_kw = v;
  }

  // Efficiency: "3.5 mi/kWh", "MPGe: 134" (convert: MPGe / 33.7 ≈ mi/kWh)
  const effMatch = text.match(/\b(\d+(?:\.\d+)?)\s*mi(?:les?)?\s*\/\s*kWh/i);
  if (effMatch) {
    const v = parseFloat(effMatch[1]);
    if (v >= 1 && v <= 10) specs.efficiency_mi_per_kwh = v;
  } else {
    // Derive from range + battery if both available
    if (specs.range_mi && specs.battery_kwh) {
      const derived = Math.round((specs.range_mi / specs.battery_kwh) * 10) / 10;
      if (derived >= 1 && derived <= 10) specs.efficiency_mi_per_kwh = derived;
    }
  }

  return specs;
}

export const maxDuration = 30;

/**
 * SSRF protection: block private IPs, localhost, reserved ranges.
 * Returns error string if blocked, null if safe.
 */
function checkSSRF(hostname: string): string | null {
  const lower = hostname.toLowerCase();

  // Block localhost variants
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "[::1]" ||
    lower === "0.0.0.0"
  ) {
    return "Blocked: localhost";
  }

  // Block private/internal TLDs
  if (lower.endsWith(".local") || lower.endsWith(".internal") || lower.endsWith(".localhost")) {
    return "Blocked: internal hostname";
  }

  // Block IP literals (IPv4)
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    // 10.0.0.0/8
    if (a === 10) return "Blocked: private IP range";
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return "Blocked: private IP range";
    // 192.168.0.0/16
    if (a === 192 && b === 168) return "Blocked: private IP range";
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return "Blocked: link-local IP";
    // 127.0.0.0/8
    if (a === 127) return "Blocked: loopback IP";
    // 0.0.0.0/8
    if (a === 0) return "Blocked: reserved IP";
  }

  // Block IPv6 literals in brackets
  if (hostname.startsWith("[")) {
    return "Blocked: IPv6 literal";
  }

  return null; // Safe
}

export async function POST(request: NextRequest) {
  const elapsed = startTimer();
  const clientIP = getClientIP(request);

  // IP burst limit — coarse guard
  const burst = receiptBurstLimiter.check(clientIP);
  if (!burst.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  const url = body.url as string | undefined;
  const text = body.text as string | undefined;
  const sessionId = (body.receipt_token as string) || null;
  const extractSessionKey = sessionId || clientIP;

  // Per-session extract limit — prevents a single session from burning ScrapingBee
  // credits on repeated failed attempts. 5 extractions per session per 10 minutes.
  // Only applies to URL mode (text extraction is cheap).
  if (url) {
    const sessionExtractLimit = extractSessionLimiter.check(extractSessionKey);
    if (!sessionExtractLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many extraction attempts. Fill in the details manually below.",
          diagnostics: { failureReason: "session_extract_limit" },
        },
        { status: 429 }
      );
    }
  }

  if (
    (!url || typeof url !== "string") &&
    (!text || typeof text !== "string" || text.trim().length < 20)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide a listing URL or paste at least 20 characters of listing text",
      },
      { status: 400 }
    );
  }

  // --- Text-mode extraction (no URL) ---
  if (text && !url) {
    try {
      const result = await extractFieldsFromText(text);
      const extraction_id = uuidv4();

      const field_confidence: Record<string, FieldConfidence> = {};
      const allFieldKeys = ["year", "make", "model", "trim", "mileage", "price", "vin", "location"];
      for (const key of allFieldKeys) {
        field_confidence[key] = result.extractedFields.includes(key) ? "extracted" : "missing";
      }

      // Log event
      if (isSupabaseConfigured() && sessionId && !isInternalTester(sessionId)) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_success",
            url_domain: "text_paste",
          });
        } catch {
          // swallow
        }
      }

      // Log extraction attempt
      if (isSupabaseConfigured() && !isInternalTester(sessionId ?? "")) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: "text_paste",
            input_mode: "text",
            success: true,
            extracted_field_count: result.extractedFields.length,
            duration_ms: elapsed(),
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json({
        success: true,
        fields: result.fields,
        field_confidence,
        extraction_id,
        listing_source: "text_paste",
        parse_confidence: result.confidence,
        extractedFields: result.extractedFields,
        missingFields: result.missingFields,
        warnings: [],
        diagnostics: null,
      });
    } catch (error) {
      logApi("error", "Text extraction failed", { endpoint: "/api/receipt/fetch", error_code: "text_extract_fail", elapsed_ms: elapsed() });

      if (isSupabaseConfigured() && sessionId && !isInternalTester(sessionId)) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_fail",
            url_domain: "text_paste",
          });
        } catch {
          // swallow
        }
      }

      // Log failed extraction attempt
      if (isSupabaseConfigured() && !isInternalTester(sessionId ?? "")) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: "text_paste",
            input_mode: "text",
            success: false,
            failure_reason: "parse_failure",
            duration_ms: elapsed(),
            error_message: error instanceof Error ? error.message : "Unknown error",
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      return NextResponse.json(
        { success: false, error: "Failed to extract details from text" },
        { status: 500 }
      );
    }
  }

  // --- URL-mode extraction ---

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url!);
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid URL format" },
      { status: 400 }
    );
  }

  // Auto-upgrade http to https — all major listing sites support it
  if (parsedUrl.protocol === "http:") {
    parsedUrl = new URL(parsedUrl.href.replace(/^http:/, "https:"));
  }

  // SSRF: block non-HTTPS schemes (ftp://, file://, etc.)
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { success: false, error: "Only HTTPS URLs are supported" },
      { status: 400 }
    );
  }

  // SSRF: Block private/reserved hosts
  const ssrfBlock = checkSSRF(parsedUrl.hostname);
  if (ssrfBlock) {
    return NextResponse.json(
      { success: false, error: "URL not allowed" },
      { status: 400 }
    );
  }

  const urlDomain = parsedUrl.hostname.replace("www.", "");

  // --- Supported domain check ---
  const SUPPORTED_SCRAPE_DOMAINS = ["cargurus.com", "autotrader.com", "cars.com", "carvana.com", "carmax.com"];
  const isOffoInventory =
    parsedUrl.hostname === "offolab.com" || parsedUrl.hostname === "www.offolab.com";
  const isSupportedDomain = isOffoInventory ||
    SUPPORTED_SCRAPE_DOMAINS.some(d => urlDomain === d || urlDomain.endsWith(`.${d}`));

  if (!isSupportedDomain) {
    return NextResponse.json(
      {
        success: false,
        error: "Only CarGurus, AutoTrader, Cars.com, Carvana, and CarMax links are supported for auto-extraction. For other sites, paste the listing text below.",
        unsupported_domain: true,
        supported_domains: SUPPORTED_SCRAPE_DOMAINS,
      },
      { status: 422 }
    );
  }

  // --- OFFO internal dealer inventory shortcut ---
  // Pattern: https://offolab.com/dealers/{slug}/inventory/{uuid}
  // These URLs are not scrapable — pull directly from dealer_inventory table.
  const dealerInventoryMatch = parsedUrl.pathname.match(/^\/dealers\/([^/]+)\/inventory\/([0-9a-f-]{36})$/i);
  if (
    (parsedUrl.hostname === "offolab.com" || parsedUrl.hostname === "www.offolab.com") &&
    dealerInventoryMatch
  ) {
    const inventoryId = dealerInventoryMatch[2];
    const adminSupabase = getSupabaseAdmin();
    if (adminSupabase) {
      const { data: inv } = await adminSupabase
        .from("dealer_inventory")
        .select("id, make, model, year, trim, price_cents, mileage, vin, photo_urls, dealership_id, dealerships(name, city, state)")
        .eq("id", inventoryId)
        .maybeSingle();

      if (inv && inv.make && inv.model) {
        const dealer = Array.isArray(inv.dealerships) ? inv.dealerships[0] : inv.dealerships;
        const dealerName = (dealer as { name?: string } | null)?.name ?? null;
        const dealerCity = (dealer as { city?: string } | null)?.city ?? null;
        const dealerState = (dealer as { state?: string } | null)?.state ?? null;
        const location = [dealerCity, dealerState].filter(Boolean).join(", ") || null;

        const price = inv.price_cents ? Math.round(inv.price_cents / 100) : undefined;
        const photoUrls: string[] = Array.isArray(inv.photo_urls) ? inv.photo_urls : [];
        if (photoUrls.length === 0) {
          const staticUrl = getStaticPhotoUrl(inv.make, inv.model, inv.year ?? undefined);
          if (staticUrl) photoUrls.push(staticUrl);
        }

        // VIN title check — non-fatal if it fails
        let titleStatus: FetchedListingFields["title_status"] = undefined;
        const accidentsReported: FetchedListingFields["accidents_reported"] = undefined;
        if (inv.vin) {
          const vinResult = await titleCheck(inv.vin).catch(() => null);
          if (vinResult?.success) {
            titleStatus = vinResult.salvage ? "salvage" : "clean";
          }
        }

        const fields: FetchedListingFields = {
          year: inv.year ?? undefined,
          make: inv.make,
          model: inv.model,
          trim: inv.trim ?? undefined,
          mileage: inv.mileage ?? undefined,
          price,
          vin: inv.vin ?? undefined,
          location: location ?? undefined,
          title_status: titleStatus,
          accidents_reported: accidentsReported,
        };

        const extractedFieldKeys = (Object.keys(fields) as (keyof FetchedListingFields)[])
          .filter((k) => fields[k] !== undefined && fields[k] !== null);

        const field_confidence: Record<string, FieldConfidence> = {};
        for (const k of ["year", "make", "model", "trim", "mileage", "price", "vin", "location", "title_status", "accidents_reported"]) {
          field_confidence[k] = extractedFieldKeys.includes(k as keyof FetchedListingFields) ? "extracted" : "missing";
        }

        // Fetch dealer logo + id for the contact button on the receipt page
        let dealerInfoPayload: { id: string; name: string; slug: string; logo_url: string | null } | null = null;
        if (inv.dealership_id && dealerName) {
          const { data: dealerRow } = await adminSupabase
            .from("dealerships")
            .select("id, name, slug, logo_url")
            .eq("id", inv.dealership_id)
            .maybeSingle();
          if (dealerRow) {
            dealerInfoPayload = { id: dealerRow.id, name: dealerRow.name, slug: dealerRow.slug, logo_url: dealerRow.logo_url ?? null };
          }
        }

        return NextResponse.json({
          success: true,
          fields,
          field_confidence,
          extraction_id: uuidv4(),
          listing_source: dealerName ? `offo:${dealerName}` : "offo.dealer",
          dealer_info: dealerInfoPayload,
          inventory_id: inv.id,
          photo_urls: photoUrls,
          parse_confidence: "high",
          extractedFields: extractedFieldKeys,
          missingFields: [],
          warnings: [],
          diagnostics: null,
        });
      }
    }
    // Inventory row not found — fall through to generic scraper (will fail gracefully)
  }

  try {
    const result = await extractVehicleData(url!);

    if (!result.success || !result.data) {
      // Log fetch_fail event
      if (isSupabaseConfigured() && sessionId && !isInternalTester(sessionId)) {
        try {
          await supabase.from("receipt_events").insert({
            session_id: sessionId,
            event_type: "fetch_fail",
            url_domain: urlDomain,
          });
        } catch {
          // swallow
        }
      }

      // Log extraction attempt (failure)
      if (isSupabaseConfigured() && !isInternalTester(sessionId ?? "")) {
        try {
          await supabase.from("extraction_attempts").insert({
            session_id: sessionId,
            domain: urlDomain,
            input_mode: "url",
            success: false,
            failure_reason: result.diagnostics?.failureReason || null,
            fetch_method: result.diagnostics?.fetchMethod || null,
            proxy_status: result.diagnostics?.proxyStatusCode || null,
            direct_status: result.diagnostics?.directStatusCode || null,
            bot_protection_detected: result.diagnostics?.botProtectionDetected || false,
            bot_protection_type: result.diagnostics?.botProtectionType || null,
            extracted_field_count: result.diagnostics?.extractedFieldCount || 0,
            duration_ms: result.diagnostics?.durationMs || 0,
            error_message: result.error || result.diagnostics?.errorMessage || null,
            ip_hash: hashIP(clientIP),
          });
        } catch { /* non-critical */ }
      }

      // Return any partial fields the scraper managed to extract so the client
      // can pre-populate the manual form rather than showing a blank slate.
      const partialFields: Partial<FetchedListingFields> = result.data ? {
        year: result.data.year,
        make: result.data.make,
        model: result.data.model,
        trim: result.data.trim,
        mileage: result.data.mileage,
        price: result.data.price,
        vin: result.data.vin,
        location: result.data.location,
        title_status: result.data.title_status,
        accidents_reported: result.data.accidents_reported,
      } : {};
      const partialFieldCount = Object.values(partialFields).filter(
        (v) => v !== undefined && v !== null
      ).length;

      return NextResponse.json(
        {
          success: false,
          error: result.error || "Could not extract listing data from this URL",
          warnings: result.warnings,
          diagnostics: result.diagnostics || null,
          partial_fields: partialFieldCount > 0 ? partialFields : null,
          partial_field_count: partialFieldCount,
        },
        { status: 422 }
      );
    }

    // Enrich with Auto.dev + Marketcheck in parallel (max 8s budget)
    const autoDevPromise = enrichFromAutodev({
      vin: result.data.vin,
      make: result.data.make,
      model: result.data.model,
      year: result.data.year,
    });
    // CarGurus direct photos API — runs in parallel when URL is a CarGurus listing.
    // CarGurus only embeds 4-6 preview photos in __remixContext (server-rendered), but their
    // internal API returns the full pictures array for a listing by numeric ID.
    const cgListingIdForPhotos = url && url.includes('cargurus.com')
      ? (url.match(/\/details\/(\d{7,12})/)?.[1] ?? null)
      : null;
    const cgPhotosPromise: Promise<string[]> = cgListingIdForPhotos
      ? fetch(`https://www.cargurus.com/api/listing/v1/detail/${cgListingIdForPhotos}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'application/json',
            'Referer': 'https://www.cargurus.com/',
          },
          signal: AbortSignal.timeout(8000),
        })
          .then(r => r.ok ? r.json() : null)
          .then((json: Record<string, unknown> | null) => {
            if (!json) return [];
            const pics = (json.pictures ?? json.vehiclePhotos ?? json.photos ?? []) as Array<Record<string, unknown>>;
            if (!Array.isArray(pics)) return [];
            // Log first pic structure to understand available keys
            if (pics.length > 0) {
              const first = pics[0];
              const scaled = first.scaledPictures as Record<string, unknown> | undefined;
              console.log(`[Fetch] CG API first pic keys: ${Object.keys(first).join(', ')}`);
              if (scaled) console.log(`[Fetch] CG API scaledPictures keys: ${Object.keys(scaled).join(', ')}`);
            }
            const seen = new Set<string>();
            const out: string[] = [];
            for (const p of pics) {
              // Prefer largest scaledPictures size, fall back to url
              const scaled = p.scaledPictures as Record<string, { url?: string }> | undefined;
              // Try common CarGurus size keys from largest to smallest
              const large = scaled?.['SIZE_1024x768']?.url
                ?? scaled?.['SIZE_800x600']?.url
                ?? scaled?.['SIZE_640x480']?.url
                ?? scaled?.['SIZE_480x360']?.url
                ?? (p.url as string | undefined);
              if (typeof large !== 'string' || !large.startsWith('https://')) continue;
              // Dedup by pic ID (e.g. pic-123456789) to avoid counting different size
              // variants of the same shot as separate photos
              const picIdMatch = large.match(/pic-(\d+)/);
              const dedupKey = picIdMatch ? picIdMatch[1] : large.split('?')[0];
              if (!seen.has(dedupKey)) { seen.add(dedupKey); out.push(large); }
              if (out.length >= 50) break;
            }
            console.log(`[Fetch] CarGurus API photos for listing ${cgListingIdForPhotos}: ${out.length}`);
            return out;
          })
          .catch(() => [])
      : Promise.resolve([]);

    // Map to FetchedListingFields (including VIN)
    const fields: FetchedListingFields = {
      year: result.data.year,
      make: result.data.make,
      model: result.data.model,
      trim: result.data.trim,
      mileage: result.data.mileage,
      price: result.data.price,
      vin: result.data.vin,
      location: result.data.location,
      url_domain: urlDomain,
      title_status: result.data.title_status,
      accidents_reported: result.data.accidents_reported,
    };

    // Map EV specs extracted directly by the scraper (from __NEXT_DATA__ or HTML patterns)
    if (result.data.range_mi) fields.range_mi = result.data.range_mi;
    if (result.data.battery_kwh) fields.battery_kwh = result.data.battery_kwh;
    if (result.data.dc_fast_kw) fields.dc_fast_kw = result.data.dc_fast_kw;
    if (result.data.efficiency_mi_per_kwh) fields.efficiency_mi_per_kwh = result.data.efficiency_mi_per_kwh;

    // Fallback: parse EV specs from the raw page text (catches remaining patterns)
    if (result.data.raw_text && (!fields.range_mi || !fields.battery_kwh)) {
      const evSpecs = parseEvSpecsFromText(result.data.raw_text);
      if (!fields.range_mi && evSpecs.range_mi) fields.range_mi = evSpecs.range_mi;
      if (!fields.battery_kwh && evSpecs.battery_kwh) fields.battery_kwh = evSpecs.battery_kwh;
      if (!fields.dc_fast_kw && evSpecs.dc_fast_kw) fields.dc_fast_kw = evSpecs.dc_fast_kw;
      if (!fields.efficiency_mi_per_kwh && evSpecs.efficiency_mi_per_kwh) fields.efficiency_mi_per_kwh = evSpecs.efficiency_mi_per_kwh;
    }

    // Derive efficiency from range ÷ battery if not yet set
    if (!fields.efficiency_mi_per_kwh && fields.range_mi && fields.battery_kwh) {
      const derived = Math.round((fields.range_mi / fields.battery_kwh) * 10) / 10;
      if (derived >= 1 && derived <= 10) fields.efficiency_mi_per_kwh = derived;
    }

    // Await Auto.dev + CarGurus API + NHTSA recalls in parallel.
    // Skip Auto.dev wait when no VIN was extracted.
    const [autoDevData, cgApiPhotos, recallData] = await Promise.all([
      result.data.vin
        ? autoDevPromise
        : (autoDevPromise.catch(() => {}), Promise.resolve({ photo_urls: [], market_price_range: undefined, vin_data: undefined, source: "none" as const })),
      cgPhotosPromise,
      (fields.make && fields.model && fields.year)
        ? getNhtsaRecalls(fields.make, fields.model, fields.year).catch(() => null)
        : Promise.resolve(null),
    ]);

    // Photo priority: CarGurus API > scraped > Auto.dev > static map
    const dedupPhotos = (urls: string[]): string[] => {
      const seen = new Set<string>();
      return urls.filter(u => {
        const norm = u.split("?")[0];
        if (seen.has(norm)) return false;
        seen.add(norm);
        return true;
      });
    };
    const isCarGurusUrl = !!(url && url.includes("cargurus.com"));
    const scrapedPhotos = result.data.photo_urls?.length ? dedupPhotos(result.data.photo_urls) : [];

    // Tier 0: OFFO local CSV — always wins when we have a curated image for this vehicle.
    // This prevents wrong cars scraped from listing pages (e.g. nearby inventory thumbnails).
    const localImages = fields.make && fields.model
      ? lookupLocalImages(fields.make, fields.model, fields.year ?? undefined)
      : { matched: false, urls: [] };

    // Photos: only use OFFO curated local images or Wikimedia static fallback.
    // Scraped/CDN photos are excluded — users upload listing photos themselves for photo analysis.
    if (localImages.matched && localImages.urls.length > 0) {
      fields.photo_urls = localImages.urls;
      console.log(`[Fetch] ${localImages.urls.length} local images`);
    } else {
      const staticUrl = getStaticPhotoUrl(fields.make, fields.model, fields.year ?? undefined);
      if (staticUrl) fields.photo_urls = [staticUrl];
    }
    if (autoDevData?.market_price_range) {
      fields.market_price_range = autoDevData.market_price_range;
    }
    if (autoDevData?.vin_data) {
      const vd = autoDevData.vin_data;
      const engineParts = [
        vd.engine?.cylinder ? `${vd.engine.cylinder}-cyl` : null,
        vd.engine?.size ? `${vd.engine.size}L` : null,
        vd.engine?.fuelType ?? null,
      ].filter(Boolean);
      fields.auto_dev_specs = {
        engine: engineParts.length ? engineParts.join(" ") : undefined,
        mpg_city: vd.mpg?.city,
        mpg_highway: vd.mpg?.highway,
        drive: vd.drivenWheels,
        body_style: vd.categories?.vehicleStyle,
        msrp: vd.price?.baseMsrp,
        used_tmv: vd.price?.usedTmvRetail,
      };
      // Fill missing trim from VIN decode if not extracted
      if (!fields.trim && vd.trim) fields.trim = vd.trim;
    }
    if (recallData) {
      fields.recalls = recallData;
    }
    // NOTE: We intentionally do NOT backfill VIN from autoDevData.listing_vin.
    // Auto.dev listings search returns comps for the same make/model/year — assigning
    // a different car's VIN would cause VIN history and recall lookups to return wrong data.

    // Log fetch_success event
    if (isSupabaseConfigured() && sessionId && !isInternalTester(sessionId)) {
      try {
        await supabase.from("receipt_events").insert({
          session_id: sessionId,
          event_type: "fetch_success",
          url_domain: urlDomain,
        });
      } catch {
        // swallow
      }
    }

    // Log extraction attempt (success)
    if (isSupabaseConfigured() && !isInternalTester(sessionId ?? "")) {
      try {
        await supabase.from("extraction_attempts").insert({
          session_id: sessionId,
          domain: urlDomain,
          input_mode: "url",
          success: true,
          fetch_method: result.diagnostics?.fetchMethod || null,
          proxy_status: result.diagnostics?.proxyStatusCode || null,
          direct_status: result.diagnostics?.directStatusCode || null,
          bot_protection_detected: result.diagnostics?.botProtectionDetected || false,
          bot_protection_type: result.diagnostics?.botProtectionType || null,
          extracted_field_count: result.diagnostics?.extractedFieldCount || 0,
          duration_ms: result.diagnostics?.durationMs || 0,
          ip_hash: hashIP(clientIP),
        });
      } catch { /* non-critical */ }
    }

    // Build field confidence map
    const field_confidence: Record<string, FieldConfidence> = {};
    const allFieldKeys = ["year", "make", "model", "trim", "mileage", "price", "vin", "location"];
    for (const key of allFieldKeys) {
      field_confidence[key] = result.data.extractedFields.includes(key) ? "extracted" : "missing";
    }

    return NextResponse.json({
      success: true,
      fields,
      field_confidence,
      extraction_id: uuidv4(),
      listing_source: result.data.dataSource || null,
      parse_confidence: result.data.confidence,
      extractedFields: result.data.extractedFields,
      missingFields: result.data.missingFields,
      raw_text: result.data.raw_text || null,
      photo_urls: fields.photo_urls || [],
      market_price_range: fields.market_price_range || null,
      auto_dev_specs: fields.auto_dev_specs || null,
      auto_dev_source: autoDevData.source,
      warnings: result.warnings,
      diagnostics: result.diagnostics || null,
    });
  } catch (error) {
    logApi("error", "URL fetch failed", { endpoint: "/api/receipt/fetch", error_code: "url_fetch_fail", elapsed_ms: elapsed() });

    // Log extraction attempt (unhandled error)
    if (isSupabaseConfigured() && !isInternalTester(sessionId ?? "")) {
      try {
        await supabase.from("extraction_attempts").insert({
          session_id: sessionId,
          domain: urlDomain,
          input_mode: "url",
          success: false,
          failure_reason: "unknown",
          duration_ms: elapsed(),
          error_message: error instanceof Error ? error.message : "Unhandled error",
          ip_hash: hashIP(clientIP),
        });
      } catch { /* non-critical */ }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch listing — try pasting the text instead",
      },
      { status: 500 }
    );
  }
}
