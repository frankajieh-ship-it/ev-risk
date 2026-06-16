/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches professional vehicle images.
 * Primary:    VinAudit Vehicle Images API (stock images, consistent quality)
 * Fallback 1: Auto.dev market listings (actual listing photos)
 * Fallback 2: Imagin Studios CDN renders (free, no API key required)
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";
import { getVehicleImages } from "@/lib/vinaudit-client";
import { searchByVin as marketCheckByVin } from "@/lib/marketcheck-client";
import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { extractVehicleImages } from "@/lib/image-extractor";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";

const photosRateLimiter = new RateLimiter(60 * 1000, 30); // 30 req/min per IP

export const maxDuration = 10;

// Wikimedia blocks hotlinking from non-Wikimedia referrers in production.
// Route all Wikimedia URLs through the server-side proxy which strips the Referer header.
function proxyIfWikimedia(url: string): string {
  if (url.includes("upload.wikimedia.org")) {
    return `/api/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Auto.dev exact model name overrides (after stripping make prefix).
// Key = lowercase, value = exact string Auto.dev expects.
const MODEL_EXACT_MAP: Record<string, string> = {
  // Nissan
  "leaf": "LEAF", "leaf s": "LEAF", "leaf sv": "LEAF", "leaf sl": "LEAF",
  "leaf plus": "LEAF", "leaf plus s": "LEAF", "leaf plus sv": "LEAF", "leaf plus sl": "LEAF",
  // Ford
  "mustang mach-e": "Mustang Mach-E",
  "mustang mach-e select rwd": "Mustang Mach-E",
  "mustang mach-e select": "Mustang Mach-E",
  "mustang mach-e premium rwd": "Mustang Mach-E",
  "mustang mach-e premium awd": "Mustang Mach-E",
  "mustang mach-e premium": "Mustang Mach-E",
  "mustang mach-e gt awd": "Mustang Mach-E",
  "mustang mach-e gt": "Mustang Mach-E",
  "mustang mach-e california route 1 awd": "Mustang Mach-E",
  "mustang mach-e california route 1 rwd": "Mustang Mach-E",
  "mustang mach-e california route 1": "Mustang Mach-E",
  // Volvo — Auto.dev uses "C40" / "XC40" (not "C40 Recharge")
  "c40 recharge twin ultimate eawd": "C40",
  "c40 recharge twin ultimate": "C40",
  "c40 recharge twin": "C40",
  "c40 recharge single": "C40",
  "c40 recharge": "C40",
  "c40": "C40",
  "xc40 recharge twin ultimate": "XC40",
  "xc40 recharge twin": "XC40",
  "xc40 recharge single": "XC40",
  "xc40 recharge": "XC40",
  "xc40": "XC40",
  // Genesis
  "gv60 performance": "GV60",
  "gv60 advanced": "GV60",
  "gv60 standard": "GV60",
  "gv70 electrified": "GV70 Electrified",
  "gv70 gt-line": "GV70",
  "gv70": "GV70",
  "gv80 electrified": "GV80 Electrified",
  "g80 electrified": "G80 Electrified",
  // Hyundai — Auto.dev uses title case, NOT all-caps
  "ioniq 5": "Ioniq 5", "ioniq 6": "Ioniq 6",
  // Kia
  "ev6": "EV6", "ev9": "EV9",
  // Rivian
  "r1t": "R1T", "r1s": "R1S",
  // Volkswagen
  "id.4": "ID.4", "id4": "ID.4",
  // Tesla
  "cybertruck": "Cybertruck",
  "cybertruck crew cab": "Cybertruck",
  "cybertruck foundation series": "Cybertruck",
  // Chevrolet EVs
  "bolt euv": "Bolt EUV", "bolt euv lt": "Bolt EUV", "bolt euv premier": "Bolt EUV",
  "bolt ev": "Bolt EV", "bolt ev lt": "Bolt EV", "bolt ev premier": "Bolt EV",
  "bolt": "Bolt EV",
  "equinox ev": "Equinox EV", "blazer ev": "Blazer EV", "silverado ev": "Silverado EV",
  // Cadillac
  "lyriq": "LYRIQ", "lyriq luxury 1": "LYRIQ", "lyriq luxury 2": "LYRIQ", "lyriq luxury 3": "LYRIQ",
  "lyriq sport 1": "LYRIQ", "lyriq sport 2": "LYRIQ", "lyriq v-series": "LYRIQ",
  "optiq": "OPTIQ", "escalade iq": "ESCALADE IQ",
  // BMW
  "i3": "i3", "i4": "i4", "i5": "i5", "i7": "i7", "ix": "iX", "ix3": "iX3",
  "i4 edrive40": "i4", "i4 m50": "i4", "i5 xdrive40": "i5", "i5 edrive40": "i5",
  "i7 xdrive60": "i7", "ix xdrive40": "iX", "ix xdrive50": "iX", "ix m60": "iX",
  "ix xdrive60": "iX",
  // Mercedes (make comes in as "Mercedes" or "Mercedes-Benz")
  "eqs 450+": "EQS", "eqs 580 4matic": "EQS", "eqs": "EQS",
  "eqb 300 4matic": "EQB", "eqb": "EQB",
  "eqe 350+": "EQE", "eqe": "EQE",
};

// Trim suffixes Auto.dev doesn't use — strip these from model names.
// Order matters: longer strings first.
const TRIM_SUFFIXES = [
  // Truck / cab body styles (must come before shorter suffixes)
  " crew cab", " super crew", " super cab", " extended cab", " double cab",
  " quad cab", " mega cab", " king cab", " access cab", " regular cab",
  " foundation series",
  // Powertrain descriptors (long forms before short)
  " rear-wheel drive", " all-wheel drive", " front-wheel drive",
  " dual motor", " tri motor", " single motor",
  // Range
  " long range", " standard range plus", " standard range", " extended range", " extended", " standard",
  // Performance tiers
  " performance", " plaid", " plaid+",
  // Trim levels
  " gt", " gt-line", " gt line", " wind", " earth", " light",
  " sel", " se", " limited", " blue",
  // Pack/battery descriptors (Rivian)
  " large pack", " max pack", " adventure",
  " xdrive50", " xdrive40", " edrive40", " edrive35", " m50",
  " 4s", " turbo", " turbo s", " cross turismo", " sport turismo",
  " pure", " grand touring", " grand touring+",
  // Tesla battery/powertrain designators (e.g. "Model S 90D AWD" → "Model S")
  " p100d", " p90d", " p85d", " p85+", " p85",
  " 100d", " 90d", " 85d", " 75d", " 70d", " 60d",
  // Drivetrain short forms
  " awd", " rwd", " fwd", " 4wd",
  " 450+", " 580", " 350+",
  " e-4wd",
  " select", " premium", " pro s", " pro", " plus", " s",
  // Volvo sub-model descriptors
  " twin ultimate eawd", " twin ultimate", " twin", " single motor eawd", " single motor",
  " recharge",
  // Genesis / Hyundai trim words
  " electrified", " performance", " advanced",
  // Ford Mach-E variants
  " california route 1", " california route",
  // Body styles
  " hatchback", " sedan", " suv", " crossover", " coupe", " convertible", " wagon",
  // Electric-specific descriptors
  " electric", " ev",
];

// Make aliases — Auto.dev uses specific make strings
const MAKE_ALIASES: Record<string, string> = {
  "mercedes": "Mercedes-Benz",
};

/**
 * Normalize make + model for Auto.dev search:
 * 1. Apply make aliases
 * 2. Strip make prefix from model string if present
 * 3. Apply exact model overrides
 * 4. Strip known trim suffixes to get base model name
 */
function normalizeForAutodev(
  make: string | undefined,
  model: string | undefined
): { make: string | undefined; model: string | undefined } {
  const normalizedMake = make ? (MAKE_ALIASES[make.toLowerCase()] ?? make) : make;

  if (!model) return { make: normalizedMake, model };

  let m = model.trim();

  // Strip make prefix (e.g. "Chevrolet Bolt EUV" → "Bolt EUV")
  if (normalizedMake && m.toLowerCase().startsWith(normalizedMake.toLowerCase() + " ")) {
    m = m.slice(normalizedMake.length + 1).trim();
  } else if (make && m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }

  // Apply exact overrides first
  const exactKey = m.toLowerCase();
  if (MODEL_EXACT_MAP[exactKey]) {
    return { make: normalizedMake, model: MODEL_EXACT_MAP[exactKey] };
  }

  // Strip known trim suffixes (case-insensitive) — loop until no more match
  let stripped = true;
  while (stripped) {
    stripped = false;
    const mLower = m.toLowerCase();
    for (const suffix of TRIM_SUFFIXES) {
      if (mLower.endsWith(suffix)) {
        m = m.slice(0, m.length - suffix.length).trim();
        // Re-check exact map after stripping
        const newKey = m.toLowerCase();
        if (MODEL_EXACT_MAP[newKey]) {
          return { make: normalizedMake, model: MODEL_EXACT_MAP[newKey] };
        }
        stripped = true;
        break;
      }
    }
  }

  return { make: normalizedMake, model: m };
}


export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const rateCheck = photosRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) } }
    );
  }

  const p = request.nextUrl.searchParams;
  const vin = p.get("vin") || undefined;
  const make = p.get("make") || undefined;
  const rawModel = p.get("model") || undefined;
  const year = p.get("year") ? Number(p.get("year")) : undefined;
  const skipStatic = p.get("skip_static") === "1";
  // no_market=1: stop after static/VinAudit tiers — never call Auto.dev market listings.
  // Use this on receipt pages where wrong-car images are worse than no image.
  const noMarket = p.get("no_market") === "1";

  if (!vin && !make) {
    return NextResponse.json({ photo_urls: [] });
  }

  // 0a. Marketcheck by VIN — actual dealer photos, highest reliability
  if (vin) {
    const mc = await marketCheckByVin(vin);
    if (mc.success && mc.photo_links.length > 0) {
      return NextResponse.json({ photo_urls: mc.photo_links, source: "marketcheck" });
    }
  }

  // 0b. OFFO image extractor — local CSV (Tier 0) or Supabase cache hit
  // Returns immediately for: cached results OR local CSV matches (no external API needed)
  // Wrapped in try/catch — VinAudit errors inside extractVehicleImages must not crash the handler
  if (make && rawModel && year) {
    try {
      const extracted = await extractVehicleImages({ make, model: rawModel, year, vin, trim: undefined });
      if (extracted.urls.length > 0 && (extracted.cache_hit || extracted.source === "offo_local")) {
        return NextResponse.json({ photo_urls: extracted.urls.map(proxyIfWikimedia), source: extracted.source, quality_score: extracted.quality_score, cache_hit: extracted.cache_hit });
      }
    } catch {
      // Fall through to static map — VinAudit timeout/error is non-fatal
    }
  }

  // 1. VinAudit VIN lookup — highest quality, exact vehicle match
  if (vin) {
    const result = await getVehicleImages({ vin, year, make, model: rawModel, limit: 6 });
    if (result.success && result.photo_urls.length > 0) {
      return NextResponse.json({ photo_urls: result.photo_urls, source: "vinaudit" });
    }
  }

  // 2. Static curated map — zero-latency, always the correct car, covers all common EVs
  // Skip when caller already tried the static URL and it 404'd
  if (!skipStatic) {
    const staticUrl = getStaticPhotoUrl(make, rawModel, year ?? undefined);
    if (staticUrl) {
      return NextResponse.json({ photo_urls: [proxyIfWikimedia(staticUrl)], source: "static" });
    }

    // 2b. Make-level fallback — closest known model photo for same make
    // Runs when model is unknown/unmapped but make is recognized
    const makeFallbackUrl = make ? MAKE_FALLBACK_MAP[make.toLowerCase()] : undefined;
    if (makeFallbackUrl) {
      return NextResponse.json({ photo_urls: [proxyIfWikimedia(makeFallbackUrl)], source: "make_fallback" });
    }
  }

  // 3. VinAudit YMM lookup — reliable stock images keyed by make/model/year
  if (make) {
    const result = await getVehicleImages({ year, make, model: rawModel, limit: 6 });
    if (result.success && result.photo_urls.length > 0) {
      return NextResponse.json({ photo_urls: result.photo_urls, source: "vinaudit_ymm" });
    }
  }

  // 4. Auto.dev listing photos — last resort; apply strict make+model+year filtering.
  //    Skipped when no_market=1 (e.g. receipt page fallbacks) to prevent wrong-car images.
  if (noMarket) {
    return NextResponse.json({ photo_urls: [], source: "none" });
  }

  const { make: normalizedMake, model } = normalizeForAutodev(make, rawModel);
  const result = await searchListings({ vin, make: normalizedMake, model, year, limit: 10 });

  const photoUrls: string[] = [];
  if (result?.records) {
    for (const record of result.records) {
      // Strict make check: record make must equal expected make (not just substring)
      if (normalizedMake && record.make) {
        const recordMake = record.make.toLowerCase().replace(/[^a-z0-9]/g, "");
        const expectedMake = normalizedMake.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (recordMake !== expectedMake) continue;
      }
      // Model check: all words > 1 char in expected model must appear in record model
      if (model && record.model) {
        const recordModel = record.model.toLowerCase();
        const expectedModel = model.toLowerCase();
        const modelWords = expectedModel.split(" ").filter((w) => w.length > 1);
        if (modelWords.length > 0 && !modelWords.every((w) => recordModel.includes(w))) continue;
      }
      // Year check: record year must be within ±1 of requested year (avoids redesign-era mismatch)
      if (year && record.year) {
        if (Math.abs(Number(record.year) - year) > 1) continue;
      }
      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (photoUrls.length >= 6) break;
    }
  }

  if (photoUrls.length > 0) {
    return NextResponse.json({ photo_urls: photoUrls, source: "autodev" });
  }

  return NextResponse.json({ photo_urls: [], source: "none" });
}
