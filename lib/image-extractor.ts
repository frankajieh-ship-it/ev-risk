/**
 * OFFO Image Extractor
 *
 * Unified vehicle image pipeline with Supabase caching, quality scoring,
 * and a 5-tier extraction chain:
 *   Tier 0: OFFO local CSV DB     (quality 100) — your own curated photos
 *   Tier 1: VinAudit by VIN      (quality 95)  — exact vehicle match
 *   Tier 2: VinAudit by YMM      (quality 80)  — model stock photos
 *   Tier 3: Listing scrape        (quality 50-70) — actual listing photos
 *   Tier 4: Wikimedia static map  (quality 70)  — curated fallback
 *
 * Cache TTLs:
 *   Local CSV:    no cache (reads file, hot-reloads on CSV change)
 *   VIN-keyed:    90 days  (exact vehicle, photos don't change)
 *   YMM-keyed:    30 days  (model photos are stable)
 *   Scrape-sourced: 7 days (listing photos expire when listing sells)
 *   Wikimedia:    60 days  (stable CDN)
 */

import { getVehicleImages } from "@/lib/vinaudit-client";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { lookupLocalImages } from "@/lib/vehicle-image-db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageSource =
  | "offo_local"
  | "vinaudit_vin"
  | "vinaudit_ymm"
  | "listing_scrape"
  | "wikimedia"
  | "none";

export interface ExtractedImages {
  urls: string[];
  primary_url: string;
  source: ImageSource;
  quality_score: number;
  cache_hit: boolean;
  extraction_ms: number;
}

export interface ImageExtractParams {
  make: string;
  model: string;
  year: number;
  vin?: string;
  trim?: string;
  /** Raw HTML from listing scraper — used for Tier 3 */
  listing_html?: string;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function normMake(s: string) { return s.toLowerCase().trim(); }
function normModel(s: string) { return s.toLowerCase().trim(); }
function normTrim(s: string | undefined) { return (s ?? "").toLowerCase().trim(); }

async function cacheGet(params: ImageExtractParams): Promise<ExtractedImages | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const now = new Date().toISOString();
    // VIN lookup first (most specific)
    if (params.vin) {
      const { data } = await supabase
        .from("vehicle_images")
        .select("*")
        .eq("vin", params.vin.toUpperCase())
        .gt("expires_at", now)
        .maybeSingle();
      if (data) {
        // Increment hit counter async (don't await)
        supabase.from("vehicle_images").update({ hit_count: (data.hit_count ?? 0) + 1 }).eq("id", data.id).then(() => {});
        return { urls: data.urls, primary_url: data.primary_url, source: data.source as ImageSource, quality_score: data.quality_score, cache_hit: true, extraction_ms: 0 };
      }
    }
    // YMM lookup
    const { data } = await supabase
      .from("vehicle_images")
      .select("*")
      .eq("make", normMake(params.make))
      .eq("model", normModel(params.model))
      .eq("year", params.year)
      .eq("trim", normTrim(params.trim))
      .gt("expires_at", now)
      .maybeSingle();
    if (data) {
      supabase.from("vehicle_images").update({ hit_count: (data.hit_count ?? 0) + 1 }).eq("id", data.id).then(() => {});
      return { urls: data.urls, primary_url: data.primary_url, source: data.source as ImageSource, quality_score: data.quality_score, cache_hit: true, extraction_ms: 0 };
    }
  } catch {
    // Cache failure is non-fatal
  }
  return null;
}

async function cacheSet(params: ImageExtractParams, result: Omit<ExtractedImages, "cache_hit">): Promise<void> {
  if (!isSupabaseConfigured() || result.urls.length === 0) return;

  const ttlDays = result.source === "offo_local" ? 1   // short TTL: re-reads CSV daily so edits propagate
    : result.source === "vinaudit_vin" ? 90
    : result.source === "wikimedia" ? 60
    : result.source === "listing_scrape" ? 7
    : 30;

  const expires = new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  const row = {
    vin: params.vin?.toUpperCase() ?? null,
    make: normMake(params.make),
    model: normModel(params.model),
    year: params.year,
    trim: normTrim(params.trim) || null,
    urls: result.urls,
    primary_url: result.primary_url,
    url_count: result.urls.length,
    quality_score: result.quality_score,
    source: result.source,
    extraction_ms: result.extraction_ms,
    expires_at: expires,
    hit_count: 0,
  };

  try {
    // Upsert by VIN if available, else by YMM
    if (params.vin) {
      await supabase.from("vehicle_images").upsert(row, { onConflict: "vin" });
    } else {
      await supabase.from("vehicle_images").upsert(row, { onConflict: "make,model,year,trim" });
    }
  } catch {
    // Cache write failure is non-fatal
  }
}

// ---------------------------------------------------------------------------
// Tier 3: Extract photos from raw listing HTML
// ---------------------------------------------------------------------------

// CDN domains that serve real vehicle listing photos
const LISTING_PHOTO_DOMAINS = [
  "photos.dealer.com",
  "img.autotrader.com",
  "static.cargurus.com",
  "media.cargurus.com",
  "images.cars.com",
  "i.cars.com",
  "content.homenetiol.com",
  "pictures.dealer.com",
  "cdn.dealereprocess.com",
  "images.autotrader.com",
  "img.carvana.com",
  "carmax.scene7.com",
  "photon.vroom.com",
];

// URL patterns that indicate logos, icons, or UI elements (not car photos)
const EXCLUDE_PATTERNS = [
  /logo/i, /icon/i, /badge/i, /sprite/i, /thumb/i,
  /button/i, /banner/i, /avatar/i, /placeholder/i,
  /loading/i, /spinner/i, /chevron/i, /arrow/i,
];

export function extractPhotosFromHtml(html: string, limit = 8): string[] {
  const found: string[] = [];
  if (!html) return found;

  // Match <img> tags and extract src / data-src / data-lazy-src
  const imgTagPattern = /<img[^>]+>/gi;
  const srcPattern = /(?:data-lazy-src|data-src|src)=["']([^"']+)["']/i;
  const widthPattern = /width=["']?(\d+)/i;

  const candidates: Array<{ url: string; width: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = imgTagPattern.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = srcPattern.exec(tag);
    if (!srcMatch) continue;

    const url = srcMatch[1];
    if (!url.startsWith("http")) continue;

    // Skip excluded patterns
    if (EXCLUDE_PATTERNS.some((p) => p.test(url))) continue;

    // Skip non-listing domains (only accept known CDN domains or relative paths)
    const urlDomain = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
    const isListingDomain = LISTING_PHOTO_DOMAINS.some((d) => urlDomain.endsWith(d));
    if (!isListingDomain) continue;

    const widthMatch = widthPattern.exec(tag);
    const width = widthMatch ? parseInt(widthMatch[1]) : 0;

    // Filter out tiny images (thumbnails, icons)
    if (width > 0 && width < 200) continue;

    candidates.push({ url, width });
  }

  // Sort by declared width descending (largest images first)
  candidates.sort((a, b) => b.width - a.width);

  // Deduplicate
  const seen = new Set<string>();
  for (const c of candidates) {
    const normalized = c.url.split("?")[0]; // ignore query params for dedup
    if (!seen.has(normalized)) {
      seen.add(normalized);
      found.push(c.url);
    }
    if (found.length >= limit) break;
  }

  return found;
}

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

function scoreResult(source: ImageSource, urls: string[], trim?: string, trimMatched?: boolean): number {
  if (source === "offo_local") return 100;
  if (source === "vinaudit_vin") return 95;
  if (source === "vinaudit_ymm") return trimMatched ? 85 : 80;
  if (source === "wikimedia") return 70;
  if (source === "listing_scrape") {
    let score = 50;
    if (urls.length >= 3) score += 10;
    if (urls.length >= 6) score += 5;
    return Math.min(score, 70);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Main extractor
// ---------------------------------------------------------------------------

export async function extractVehicleImages(params: ImageExtractParams): Promise<ExtractedImages> {
  const start = Date.now();

  // --- Cache check ---
  const cached = await cacheGet(params);
  if (cached) return cached;

  // --- Tier 0: OFFO local CSV image database ---
  // Your own curated photos — edit data/vehicle-images.csv to add entries.
  // Local /vehicles/ paths are served from public/vehicles/.
  // This tier is NOT cached (file is hot-reloaded when CSV changes).
  const localResult = lookupLocalImages(params.make, params.model, params.year);
  if (localResult.matched && localResult.urls.length > 0) {
    const out: Omit<ExtractedImages, "cache_hit"> = {
      urls: localResult.urls,
      primary_url: localResult.urls[0],
      source: "offo_local",
      quality_score: 100,
      extraction_ms: Date.now() - start,
    };
    cacheSet(params, out);
    return { ...out, cache_hit: false };
  }

  // --- Tier 1: VinAudit by VIN ---
  if (params.vin) {
    const result = await getVehicleImages({ vin: params.vin, year: params.year, make: params.make, model: params.model, limit: 6 });
    if (result.success && result.photo_urls.length > 0) {
      const out: Omit<ExtractedImages, "cache_hit"> = {
        urls: result.photo_urls,
        primary_url: result.photo_urls[0],
        source: "vinaudit_vin",
        quality_score: 95,
        extraction_ms: Date.now() - start,
      };
      cacheSet(params, out); // async, non-blocking
      return { ...out, cache_hit: false };
    }
  }

  // --- Tier 2: VinAudit by YMM ---
  const ymmResult = await getVehicleImages({ year: params.year, make: params.make, model: params.model, trim: params.trim, limit: 6 });
  if (ymmResult.success && ymmResult.photo_urls.length > 0) {
    const out: Omit<ExtractedImages, "cache_hit"> = {
      urls: ymmResult.photo_urls,
      primary_url: ymmResult.photo_urls[0],
      source: "vinaudit_ymm",
      quality_score: scoreResult("vinaudit_ymm", ymmResult.photo_urls, params.trim),
      extraction_ms: Date.now() - start,
    };
    cacheSet(params, out);
    return { ...out, cache_hit: false };
  }

  // --- Tier 3: Listing scrape photos ---
  if (params.listing_html) {
    const scraped = extractPhotosFromHtml(params.listing_html);
    if (scraped.length > 0) {
      const out: Omit<ExtractedImages, "cache_hit"> = {
        urls: scraped,
        primary_url: scraped[0],
        source: "listing_scrape",
        quality_score: scoreResult("listing_scrape", scraped),
        extraction_ms: Date.now() - start,
      };
      cacheSet(params, out);
      return { ...out, cache_hit: false };
    }
  }

  // --- Tier 4: Wikimedia static map ---
  const staticUrl = getStaticPhotoUrl(params.make, params.model, params.year);
  const makeFallback = !staticUrl ? (MAKE_FALLBACK_MAP[params.make.toLowerCase()] ?? null) : null;
  const fallbackUrl = staticUrl ?? makeFallback;

  if (fallbackUrl) {
    const out: Omit<ExtractedImages, "cache_hit"> = {
      urls: [fallbackUrl],
      primary_url: fallbackUrl,
      source: "wikimedia",
      quality_score: 70,
      extraction_ms: Date.now() - start,
    };
    cacheSet(params, out);
    return { ...out, cache_hit: false };
  }

  // --- No images found ---
  return {
    urls: [],
    primary_url: "",
    source: "none",
    quality_score: 0,
    cache_hit: false,
    extraction_ms: Date.now() - start,
  };
}
