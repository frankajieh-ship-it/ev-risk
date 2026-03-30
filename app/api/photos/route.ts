/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches listing photos from Auto.dev for a given vehicle.
 * Used as a client-side fallback when extraction doesn't return photos.
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";

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
  // Drivetrain short forms
  " awd", " rwd", " fwd", " 4wd",
  " 450+", " 580", " 350+",
  " e-4wd",
  " select", " premium", " pro", " plus",
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

  const { make: normalizedMake, model } = normalizeForAutodev(make, rawModel);
  const result = await searchListings({ vin, make: normalizedMake, model, year, limit: 8 });

  const photoUrls: string[] = [];
  if (result?.records) {
    for (const record of result.records) {
      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (photoUrls.length >= 6) break;
    }
  }

  return NextResponse.json({ photo_urls: photoUrls });
}
