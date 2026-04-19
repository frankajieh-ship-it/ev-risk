/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches professional vehicle images.
 * Primary: VinAudit Vehicle Images API (stock images, consistent quality)
 * Fallback: Auto.dev market listings (actual listing photos)
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";
import { getVehicleImages } from "@/lib/vinaudit-client";

export const maxDuration = 10;

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
  const p = request.nextUrl.searchParams;
  const vin = p.get("vin") || undefined;
  const make = p.get("make") || undefined;
  const rawModel = p.get("model") || undefined;
  const year = p.get("year") ? Number(p.get("year")) : undefined;

  if (!vin && !make) {
    return NextResponse.json({ photo_urls: [] });
  }

  // --- Primary: VinAudit Vehicle Images ---
  const vinauditResult = await getVehicleImages({ vin, year, make, model: rawModel, limit: 6 });
  if (vinauditResult.success && vinauditResult.photo_urls.length > 0) {
    return NextResponse.json({ photo_urls: vinauditResult.photo_urls, source: "vinaudit" });
  }

  // --- Fallback: Auto.dev listing photos ---
  const { make: normalizedMake, model } = normalizeForAutodev(make, rawModel);
  // Try with year first; if no results, retry without year (Auto.dev inventory varies by year)
  let result = await searchListings({ vin, make: normalizedMake, model, year, limit: 8 });
  if ((!result?.records || result.records.length === 0) && year) {
    result = await searchListings({ vin, make: normalizedMake, model, limit: 8 });
  }

  const photoUrls: string[] = [];
  if (result?.records) {
    for (const record of result.records) {
      // Filter by make to prevent wrong-car images (e.g. Auto.dev returning Genesis when searching BMW i5)
      if (normalizedMake && record.make) {
        const recordMake = record.make.toLowerCase();
        const expectedMake = normalizedMake.toLowerCase();
        if (!recordMake.includes(expectedMake) && !expectedMake.includes(recordMake)) continue;
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

  // --- Third fallback: Wikipedia REST API summary (more reliable than w/api.php) ---
  if (make || rawModel) {
    try {
      const { model: normModel } = normalizeForAutodev(make, rawModel);
      // Title-case the model (LEAF → Leaf, MODEL 3 → Model 3) for Wikipedia
      const titleCasedModel = normModel
        ? normModel.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("_")
        : "";
      const wikiTitle = [make, titleCasedModel].filter(Boolean).join("_");
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`,
        { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json() as { originalimage?: { source?: string }; thumbnail?: { source?: string } };
        const src = data.originalimage?.source ?? data.thumbnail?.source;
        if (src && /\.(jpe?g|png|webp)/i.test(src)) {
          return NextResponse.json({ photo_urls: [src], source: "wikipedia" });
        }
      }
    } catch { /* ignore — fall through to empty */ }
  }

  return NextResponse.json({ photo_urls: [], source: "none" });
}
