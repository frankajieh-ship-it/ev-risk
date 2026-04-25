/**
 * Text-based vehicle listing field extraction.
 * Fast path: regex parser handles structured copy-paste text (FB Marketplace,
 * CarGurus, AutoTrader etc.) without an AI call.
 * Slow path: GPT-4o-mini for unstructured or ambiguous text.
 * Server-side only (used in API routes).
 */

import OpenAI from "openai";
import type { FetchedListingFields } from "@/types/receipt";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface TextExtractionResult {
  fields: FetchedListingFields;
  extractedFields: string[];
  missingFields: string[];
  confidence: "high" | "medium" | "low";
}

/**
 * Regex-based fast extractor for structured listing copy-paste text.
 * Handles FB Marketplace, CarGurus, AutoTrader, and generic formats.
 * Returns null if fewer than 3 fields found (falls through to GPT).
 */
function extractFieldsWithRegex(text: string): Partial<FetchedListingFields> | null {
  const fields: Partial<FetchedListingFields> = {};
  const t = text.trim();

  // --- Year + Make + Model from first non-empty line ---
  // e.g. "2018 Tesla model 3 performance awd sedan"
  //      "2021 Ford Mustang Mach-E Premium"
  const firstLine = t.split(/\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  const titleMatch = firstLine.match(
    /^(\d{4})\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(.+?)(?:\s*-\s*.+)?$/
  );
  if (titleMatch) {
    const year = parseInt(titleMatch[1]);
    if (year >= 1980 && year <= 2030) {
      fields.year = year;
      // Split make from model: first word is make, rest is model+trim
      const makeModel = titleMatch[2] + " " + titleMatch[3];
      const parts = makeModel.trim().split(/\s+/);
      if (parts.length >= 2) {
        fields.make = parts[0];
        // Remaining words — strip common body-style suffixes to get model, keep trim
        const modelParts = parts.slice(1);
        const bodySuffixes = /^(sedan|suv|truck|hatchback|coupe|wagon|convertible|van|minivan|pickup|crossover)$/i;
        const modelWords: string[] = [];
        for (const p of modelParts) {
          if (bodySuffixes.test(p)) break;
          modelWords.push(p);
        }
        if (modelWords.length > 0) {
          // First word is model, rest is trim
          fields.model = modelWords[0];
          if (modelWords.length > 1) {
            fields.trim = modelWords.slice(1).join(" ");
          }
        }
      }
    }
  }

  // --- Price ---
  // "$13,980" or "Price: $13,980" or "13980"
  const priceMatch = t.match(/\$\s*([\d,]+)(?:\s|$|\/)/);
  if (priceMatch) {
    const p = parseInt(priceMatch[1].replace(/,/g, ""));
    if (p >= 500 && p <= 500000) fields.price = p;
  }

  // --- Mileage ---
  // "Driven 156,320 miles" / "156,320 miles" / "156K miles" / "Mileage: 45,000"
  const miMatch =
    t.match(/[Dd]riven\s+([\d,]+)\s+miles?/) ||
    t.match(/[Mm]ileage[:\s]+([\d,]+)/) ||
    t.match(/([\d,]+)\s+miles?\b/) ||
    t.match(/\b([\d]+)[Kk]\s+miles?/);
  if (miMatch) {
    const raw = miMatch[1].replace(/,/g, "");
    const mi = miMatch[0].toLowerCase().includes("k")
      ? parseInt(raw) * 1000
      : parseInt(raw);
    if (mi >= 0 && mi <= 999999) fields.mileage = mi;
  }

  // --- Location ---
  // "Listed 18 hours ago in West Dundee, IL"
  // "Location: Chicago, IL"
  // "West Dundee, IL"
  const locMatch =
    t.match(/(?:ago|hours?|days?|minutes?)\s+in\s+([A-Za-z\s]+,\s*[A-Z]{2})\b/) ||
    t.match(/[Ll]ocation[:\s]+([A-Za-z\s]+,\s*[A-Z]{2})\b/) ||
    t.match(/\b([A-Za-z\s]+,\s*[A-Z]{2})\b/);
  if (locMatch) {
    fields.location = locMatch[1].trim();
  }

  // --- VIN (17 chars, standard format) ---
  const vinMatch = t.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinMatch) fields.vin = vinMatch[1].toUpperCase();

  // --- EV: Fuel type → category hint (not a FetchedListingFields field, but useful) ---
  // We don't store this directly, but range/battery may appear
  const rangeMatch = t.match(
    /(?:range|est(?:imated)?\s+range)[:\s]+([\d]+)\s*mi/i
  );
  if (rangeMatch) {
    const v = parseInt(rangeMatch[1]);
    if (v >= 50 && v <= 600) fields.range_mi = v;
  }

  // Count extracted
  const extracted = Object.keys(fields).filter(
    (k) => fields[k as keyof typeof fields] !== undefined
  );

  // Only trust this result if we got at least 3 core fields
  if (extracted.length < 3) return null;

  return fields;
}

const ALL_FIELD_KEYS = ["year", "make", "model", "trim", "mileage", "price", "vin", "location", "range_mi", "battery_kwh", "dc_fast_kw", "efficiency_mi_per_kwh"];

function buildResult(fields: Partial<FetchedListingFields>): TextExtractionResult {
  const extractedFields = ALL_FIELD_KEYS.filter((k) => fields[k as keyof typeof fields] !== undefined);
  const missingFields = ALL_FIELD_KEYS.filter((k) => fields[k as keyof typeof fields] === undefined);
  const confidence: TextExtractionResult["confidence"] = extractedFields.length >= 4 ? "high" : extractedFields.length >= 2 ? "medium" : "low";
  return { fields: fields as FetchedListingFields, extractedFields, missingFields, confidence };
}

export async function extractFieldsFromText(
  text: string
): Promise<TextExtractionResult> {
  // --- Fast path: regex extractor (no AI cost, handles structured paste) ---
  const regexResult = extractFieldsWithRegex(text);
  if (regexResult) {
    return buildResult(regexResult);
  }

  // --- Slow path: GPT-4o-mini for unstructured / ambiguous text ---
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract vehicle listing details from the provided text.
Return ONLY a JSON object with these fields (use null for anything not found):
{ "year": number|null, "make": string|null, "model": string|null, "trim": string|null,
  "mileage": number|null, "price": number|null, "vin": string|null, "location": string|null,
  "range_mi": number|null, "battery_kwh": number|null, "dc_fast_kw": number|null, "efficiency_mi_per_kwh": number|null }
Parse numbers correctly: "$32,500" → 32500, "45k miles" → 45000.
For VIN, only return if you find a valid 17-character alphanumeric string.
For EV specs: range_mi = EPA or stated range in miles; battery_kwh = usable battery capacity in kWh; dc_fast_kw = peak DC fast charging speed in kW; efficiency_mi_per_kwh = miles per kWh efficiency.`,
        },
        { role: "user", content: text.substring(0, 8000) },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const fields: FetchedListingFields = {};
    for (const key of ALL_FIELD_KEYS) {
      if (parsed[key] !== null && parsed[key] !== undefined) {
        (fields as Record<string, unknown>)[key] = parsed[key];
      }
    }

    return buildResult(fields);
  } catch (err) {
    // GPT unavailable (bad key, quota, network) — return whatever regex found,
    // even partial, so the user gets pre-filled fields rather than a hard failure.
    console.warn("[text-extractor] GPT fallback failed, returning empty result:", err instanceof Error ? err.message : err);
    return buildResult({});
  }
}
